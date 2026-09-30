"use server";

import { revalidatePath } from "next/cache";
import { getCurrentWorkspace } from "@/lib/current-workspace";

export async function reviewFinding(formData: FormData) {
  const { supabase, workspace } = await getCurrentWorkspace();
  const findingId = String(formData.get("finding_id") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!findingId || !["accepted", "dismissed"].includes(decision)) return;

  const { data: finding } = await supabase
    .from("audit_findings")
    .select("id,audit_run_id,variance_amount,evidence,status")
    .eq("workspace_id", workspace.id)
    .eq("id", findingId)
    .maybeSingle();

  if (!finding) return;

  await supabase
    .from("audit_findings")
    .update({
      status: decision,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspace.id)
    .eq("id", findingId);

  if (decision === "accepted" && finding.status !== "accepted") {
    const { data: run } = await supabase
      .from("audit_runs")
      .select("invoice_id")
      .eq("workspace_id", workspace.id)
      .eq("id", finding.audit_run_id)
      .maybeSingle();

    if (run) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("carrier_id,invoice_number")
        .eq("workspace_id", workspace.id)
        .eq("id", run.invoice_id)
        .maybeSingle();

      if (invoice) {
        const evidence = (finding.evidence ?? {}) as Record<string, unknown>;
        const reason = typeof evidence.reason === "string" ? evidence.reason : "Auditointipoikkeama";

        await supabase.from("disputes").insert({
          workspace_id: workspace.id,
          audit_finding_id: findingId,
          carrier_id: invoice.carrier_id,
          status: "draft",
          disputed_amount: Math.max(Number(finding.variance_amount ?? 0), 0),
          subject: `Rahtilaskun ${invoice.invoice_number} poikkeama`,
          body: `${reason}\n\nRevanoq havaitsi poikkeaman laskun ja sovitun hinnaston välillä.`,
        });
      }
    }
  }

  revalidatePath("/findings");
  revalidatePath("/dashboard");
}
