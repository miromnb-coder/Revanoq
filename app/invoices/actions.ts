"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentWorkspace } from "@/lib/current-workspace";
import { parseInvoiceCsv } from "@/lib/csv";

function parseNumber(value: FormDataEntryValue | null) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}

export async function uploadInvoice(formData: FormData) {
  const { supabase, workspace, userId } = await getCurrentWorkspace();

  const carrierId = String(formData.get("carrier_id") ?? "");
  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim();
  const invoiceDate = String(formData.get("invoice_date") ?? "") || null;
  const currency = String(formData.get("currency") ?? "EUR").trim().toUpperCase();
  const providedTotal = parseNumber(formData.get("total_amount"));
  const file = formData.get("file");

  if (
    !carrierId ||
    !invoiceNumber ||
    currency.length !== 3 ||
    !(file instanceof File) ||
    file.size === 0
  ) {
    redirect("/invoices?error=missing");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["pdf", "csv"].includes(extension)) {
    redirect("/invoices?error=filetype");
  }

  if (file.size > 4_000_000) {
    redirect("/invoices?error=filesize");
  }

  const { data: carrier } = await supabase
    .from("carriers")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("id", carrierId)
    .maybeSingle();

  if (!carrier) redirect("/invoices?error=carrier");

  let lines: Array<{
    line_number: number;
    description: string | null;
    charge_code: string | null;
    quantity: number | null;
    unit_price: number | null;
    amount: number;
    raw_data: Record<string, unknown>;
  }> = [];

  if (extension === "csv") {
    lines = parseInvoiceCsv(await file.text());
    if (!lines.length) redirect("/invoices?error=csv");
  }

  let totalAmount = providedTotal;

  if (extension === "csv" && totalAmount == null) {
    totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  }

  if (extension === "pdf") {
    if (totalAmount == null) redirect("/invoices?error=total");
    lines = [{
      line_number: 1,
      description: "PDF-laskun kokonaissumma",
      charge_code: "BASE",
      quantity: 1,
      unit_price: totalAmount,
      amount: totalAmount,
      raw_data: {
        source: "pdf_summary",
        note: "PDF-rivien automaattinen poiminta ei ole vielä käytössä.",
      },
    }];
  }

  if (totalAmount == null) redirect("/invoices?error=total");

  const filePath = `${workspace.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(filePath, buffer, {
      contentType: file.type || (extension === "pdf" ? "application/pdf" : "text/csv"),
      upsert: false,
    });

  if (uploadError) redirect("/invoices?error=upload");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      workspace_id: workspace.id,
      carrier_id: carrierId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      currency,
      total_amount: totalAmount,
      subtotal: totalAmount,
      source_file_path: filePath,
      status: "uploaded",
      created_by: userId,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    await supabase.storage.from("invoices").remove([filePath]);
    redirect("/invoices?error=create");
  }

  const { error: linesError } = await supabase.from("invoice_lines").insert(
    lines.map((line) => ({
      workspace_id: workspace.id,
      invoice_id: invoice.id,
      line_number: line.line_number,
      description: line.description,
      charge_code: line.charge_code,
      quantity: line.quantity,
      unit_price: line.unit_price,
      amount: line.amount,
      raw_data: line.raw_data,
    })),
  );

  if (linesError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    await supabase.storage.from("invoices").remove([filePath]);
    redirect("/invoices?error=lines");
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}?message=uploaded`);
}
