"use server";

import { revalidatePath } from "next/cache";
import { getCurrentWorkspace } from "@/lib/current-workspace";

function numberValue(value: FormDataEntryValue | null) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveDisputeDraft(formData: FormData) {
  const { supabase } = await getCurrentWorkspace();
  const id = String(formData.get("dispute_id") ?? "");
  if (!id) return;

  await supabase.rpc("save_dispute_draft", {
    p_dispute_id: id,
    p_recipient_email: String(formData.get("recipient_email") ?? ""),
    p_subject: String(formData.get("subject") ?? ""),
    p_body: String(formData.get("body") ?? ""),
  });

  revalidatePath("/disputes");
  revalidatePath("/disputes/" + id);
}

export async function setDisputeProgress(formData: FormData) {
  const { supabase } = await getCurrentWorkspace();
  const id = String(formData.get("dispute_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !status) return;

  await supabase.rpc("set_dispute_progress", {
    p_dispute_id: id,
    p_status: status,
    p_credited_amount: numberValue(formData.get("credited_amount")),
    p_resolution_note: String(formData.get("resolution_note") ?? ""),
  });

  revalidatePath("/dashboard");
  revalidatePath("/findings");
  revalidatePath("/disputes");
  revalidatePath("/disputes/" + id);
}
