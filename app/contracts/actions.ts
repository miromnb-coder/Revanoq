"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentWorkspace } from "@/lib/current-workspace";

function numberOrNull(value: FormDataEntryValue | null) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createContract(formData: FormData) {
  const { supabase, workspace, userId } = await getCurrentWorkspace();

  const carrierId = String(formData.get("carrier_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "EUR").trim().toUpperCase();
  const validFrom = String(formData.get("valid_from") ?? "") || null;
  const validTo = String(formData.get("valid_to") ?? "") || null;

  if (!carrierId || name.length < 2 || currency.length !== 3) {
    redirect("/contracts?error=contract");
  }

  const { data: carrier } = await supabase
    .from("carriers")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("id", carrierId)
    .maybeSingle();

  if (!carrier) redirect("/contracts?error=carrier");

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .insert({
      workspace_id: workspace.id,
      carrier_id: carrierId,
      name,
      currency,
      valid_from: validFrom,
      valid_to: validTo,
      status: "active",
      created_by: userId,
    })
    .select("id")
    .single();

  if (contractError || !contract) {
    redirect("/contracts?error=contract");
  }

  const rules: Array<Record<string, unknown>> = [];

  const baseAmount = numberOrNull(formData.get("base_amount"));
  const baseCode = String(formData.get("base_code") ?? "BASE").trim().toUpperCase() || "BASE";
  if (baseAmount !== null) {
    rules.push({
      workspace_id: workspace.id,
      contract_id: contract.id,
      rule_type: "base_rate",
      charge_code: baseCode,
      unit: String(formData.get("base_unit") ?? "shipment"),
      base_amount: baseAmount,
    });
  }

  const fuelPercentage = numberOrNull(formData.get("fuel_percentage"));
  const fuelCode = String(formData.get("fuel_code") ?? "FUEL").trim().toUpperCase() || "FUEL";
  if (fuelPercentage !== null) {
    rules.push({
      workspace_id: workspace.id,
      contract_id: contract.id,
      rule_type: "fuel_surcharge",
      charge_code: fuelCode,
      unit: "percentage",
      percentage: fuelPercentage,
    });
  }

  for (let i = 1; i <= 3; i += 1) {
    const code = String(formData.get(`accessorial_code_${i}`) ?? "").trim().toUpperCase();
    const amount = numberOrNull(formData.get(`accessorial_amount_${i}`));
    if (code && amount !== null) {
      rules.push({
        workspace_id: workspace.id,
        contract_id: contract.id,
        rule_type: "accessorial",
        charge_code: code,
        unit: "charge",
        base_amount: amount,
      });
    }
  }

  if (rules.length) {
    const { error: rulesError } = await supabase.from("rate_rules").insert(rules);
    if (rulesError) {
      redirect("/contracts?error=rules");
    }
  }

  revalidatePath("/contracts");
  revalidatePath(`/carriers/${carrierId}`);
  redirect("/contracts?message=created");
}
