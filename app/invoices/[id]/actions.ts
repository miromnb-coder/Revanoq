"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentWorkspace } from "@/lib/current-workspace";

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export async function runAudit(formData: FormData) {
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const { supabase, workspace } = await getCurrentWorkspace();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id,carrier_id,invoice_number,invoice_date,total_amount,currency")
    .eq("workspace_id", workspace.id)
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) redirect("/invoices?error=missing");

  const { data: previousRuns } = await supabase
    .from("audit_runs")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("invoice_id", invoiceId);

  const previousRunIds = (previousRuns ?? []).map((run) => run.id);
  if (previousRunIds.length) {
    await supabase
      .from("audit_findings")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("workspace_id", workspace.id)
      .eq("status", "open")
      .in("audit_run_id", previousRunIds);
  }

  const { data: auditRun, error: runError } = await supabase
    .from("audit_runs")
    .insert({
      workspace_id: workspace.id,
      invoice_id: invoiceId,
      status: "running",
      engine_version: "mvp-1",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runError || !auditRun) {
    redirect(`/invoices/${invoiceId}?error=audit-start`);
  }

  const [{ data: lines }, { data: contracts }, { data: duplicates }] = await Promise.all([
    supabase
      .from("invoice_lines")
      .select("id,line_number,description,charge_code,quantity,unit_price,amount")
      .eq("workspace_id", workspace.id)
      .eq("invoice_id", invoiceId)
      .order("line_number"),
    supabase
      .from("contracts")
      .select("id,name,currency,valid_from,valid_to,status")
      .eq("workspace_id", workspace.id)
      .eq("carrier_id", invoice.carrier_id)
      .eq("status", "active")
      .order("valid_from", { ascending: false, nullsFirst: false }),
    supabase
      .from("invoices")
      .select("id,invoice_number,total_amount,invoice_date")
      .eq("workspace_id", workspace.id)
      .eq("carrier_id", invoice.carrier_id)
      .eq("invoice_number", invoice.invoice_number)
      .neq("id", invoiceId),
  ]);

  const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date) : new Date();
  const contract = (contracts ?? []).find((candidate) => {
    const starts = !candidate.valid_from || new Date(candidate.valid_from) <= invoiceDate;
    const ends = !candidate.valid_to || new Date(candidate.valid_to) >= invoiceDate;
    return starts && ends;
  });

  const findings: Array<Record<string, unknown>> = [];

  if (duplicates?.length) {
    findings.push({
      workspace_id: workspace.id,
      audit_run_id: auditRun.id,
      finding_type: "duplicate_invoice",
      severity: "high",
      billed_amount: Number(invoice.total_amount),
      expected_amount: 0,
      variance_amount: Number(invoice.total_amount),
      confidence: 0.99,
      evidence: {
        reason: "Samalla kuljetusyhtiöllä on toinen lasku samalla laskunumerolla.",
        duplicate_invoice_ids: duplicates.map((item) => item.id),
      },
      status: "open",
    });
  }

  let rules: Array<{
    id: string;
    rule_type: string;
    charge_code: string | null;
    unit: string | null;
    base_amount: number | null;
    percentage: number | null;
  }> = [];

  if (contract) {
    const { data } = await supabase
      .from("rate_rules")
      .select("id,rule_type,charge_code,unit,base_amount,percentage")
      .eq("workspace_id", workspace.id)
      .eq("contract_id", contract.id);

    rules = (data ?? []).map((rule) => ({
      ...rule,
      base_amount: rule.base_amount == null ? null : Number(rule.base_amount),
      percentage: rule.percentage == null ? null : Number(rule.percentage),
    }));
  }

  const invoiceLines = (lines ?? []).map((line) => ({
    ...line,
    amount: Number(line.amount),
    quantity: line.quantity == null ? null : Number(line.quantity),
  }));

  const baseCodes = new Set(
    rules
      .filter((rule) => rule.rule_type === "base_rate")
      .map((rule) => rule.charge_code?.toUpperCase())
      .filter(Boolean),
  );

  const baseSubtotal = invoiceLines
    .filter((line) => line.charge_code && baseCodes.has(line.charge_code.toUpperCase()))
    .reduce((sum, line) => sum + line.amount, 0);

  for (const line of invoiceLines) {
    const code = line.charge_code?.trim().toUpperCase() || "";
    const rule = rules.find(
      (candidate) =>
        candidate.charge_code?.trim().toUpperCase() === code && code.length > 0,
    );

    if (!rule) {
      if (contract && code && !["BASE", "FUEL"].includes(code) && line.amount > 0) {
        findings.push({
          workspace_id: workspace.id,
          audit_run_id: auditRun.id,
          invoice_line_id: line.id,
          finding_type: "accessorial_fee",
          severity: "medium",
          billed_amount: line.amount,
          expected_amount: 0,
          variance_amount: line.amount,
          confidence: 0.82,
          evidence: {
            reason: `Veloituskoodille ${code} ei löytynyt sopimuksesta vastaavaa lisämaksua.`,
            charge_code: code,
            contract_id: contract.id,
          },
          status: "open",
        });
      }
      continue;
    }

    const quantity = line.quantity ?? 1;
    let expected: number | null = null;
    let findingType = "rate_mismatch";
    let reason = "";

    if (rule.rule_type === "base_rate" && rule.base_amount != null) {
      expected = roundMoney(quantity * rule.base_amount);
      findingType = "rate_mismatch";
      reason = `Laskurivin hinta ei vastaa sopimuksen perushintaa koodille ${code}.`;
    }

    if (
      rule.rule_type === "fuel_surcharge" &&
      rule.percentage != null &&
      baseSubtotal > 0
    ) {
      expected = roundMoney(baseSubtotal * (rule.percentage / 100));
      findingType = "fuel_surcharge";
      reason = `Polttoainelisä poikkeaa sopimuksen ${rule.percentage} % tasosta.`;
    }

    if (rule.rule_type === "accessorial" && rule.base_amount != null) {
      expected = roundMoney(quantity * rule.base_amount);
      findingType = "accessorial_fee";
      reason = `Lisämaksu ${code} ei vastaa sopimuksessa määritettyä hintaa.`;
    }

    if (expected == null) continue;

    const variance = roundMoney(line.amount - expected);
    if (Math.abs(variance) < 0.01) continue;

    findings.push({
      workspace_id: workspace.id,
      audit_run_id: auditRun.id,
      invoice_line_id: line.id,
      finding_type: findingType,
      severity: Math.abs(variance) >= 100 ? "high" : "medium",
      billed_amount: line.amount,
      expected_amount: expected,
      variance_amount: variance,
      confidence: 0.98,
      evidence: {
        reason,
        charge_code: code,
        contract_id: contract?.id,
        rule_id: rule.id,
        quantity,
      },
      status: "open",
    });
  }

  if (findings.length) {
    await supabase.from("audit_findings").insert(findings);
  }

  const totalVariance = roundMoney(
    findings.reduce((sum, finding) => sum + Number(finding.variance_amount ?? 0), 0),
  );

  await Promise.all([
    supabase
      .from("audit_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: {
          finding_count: findings.length,
          total_variance: totalVariance,
          contract_id: contract?.id ?? null,
          contract_name: contract?.name ?? null,
          note: contract ? null : "Laskun päivälle ei löytynyt aktiivista sopimusta.",
        },
      })
      .eq("id", auditRun.id),
    supabase
      .from("invoices")
      .update({ status: "audited", updated_at: new Date().toISOString() })
      .eq("workspace_id", workspace.id)
      .eq("id", invoiceId),
  ]);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/findings");
  revalidatePath("/dashboard");
  redirect(`/invoices/${invoiceId}?message=audited`);
}
