"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentWorkspace } from "@/lib/current-workspace";

export async function createCarrier(formData: FormData) {
  const { supabase, workspace } = await getCurrentWorkspace();

  const name = String(formData.get("name") ?? "").trim();
  const carrierCode = String(formData.get("carrier_code") ?? "").trim() || null;
  const vatId = String(formData.get("vat_id") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;

  if (name.length < 2) {
    redirect("/carriers?error=name");
  }

  const { error } = await supabase.from("carriers").insert({
    workspace_id: workspace.id,
    name,
    carrier_code: carrierCode,
    vat_id: vatId,
    contact_email: contactEmail,
  });

  if (error) {
    redirect("/carriers?error=create");
  }

  revalidatePath("/carriers");
  redirect("/carriers?message=created");
}

export async function toggleCarrierActive(formData: FormData) {
  const { supabase, workspace } = await getCurrentWorkspace();
  const carrierId = String(formData.get("carrier_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  await supabase
    .from("carriers")
    .update({ active: !active, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspace.id)
    .eq("id", carrierId);

  revalidatePath("/carriers");
  revalidatePath(`/carriers/${carrierId}`);
}
