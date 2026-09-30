"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentWorkspace } from "@/lib/current-workspace";
import { parseInvoiceCsv } from "@/lib/csv";
import { extractPdfInvoiceLite } from "@/lib/pdf-invoice-lite";

function numberValue(value: FormDataEntryValue | null) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120);
}

function comparable(value: string | null | undefined) {
  return (value ?? "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function uploadInvoiceV2(formData: FormData) {
  const { supabase, workspace, userId } = await getCurrentWorkspace();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) redirect("/freight-invoices?error=missing");

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !["pdf", "csv"].includes(ext)) redirect("/freight-invoices?error=filetype");
  if (file.size > 4_000_000) redirect("/freight-invoices?error=filesize");

  const providedCarrier = String(formData.get("carrier_id") ?? "");
  const providedNumber = String(formData.get("invoice_number") ?? "").trim();
  const providedDate = String(formData.get("invoice_date") ?? "") || null;
  const providedCurrency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const providedTotal = numberValue(formData.get("total_amount"));
  const buffer = Buffer.from(await file.arrayBuffer());

  const { data: carriers } = await supabase
    .from("carriers")
    .select("id,name,carrier_code,vat_id,contact_email")
    .eq("workspace_id", workspace.id)
    .eq("active", true);

  let carrierId: string | null = providedCarrier || null;
  let invoiceNumber: string | null = providedNumber || null;
  let invoiceDate = providedDate;
  let dueDate: string | null = null;
  let currency: string | null = providedCurrency || null;
  let totalAmount = providedTotal;
  let subtotal: number | null = null;
  let taxAmount: number | null = null;
  let extractionData: Record<string, unknown> = { source: ext, original_file_name: file.name };
  let lines: Array<{
    line_number: number;
    description: string | null;
    charge_code: string | null;
    quantity: number | null;
    unit_price: number | null;
    amount: number;
    raw_data: Record<string, unknown>;
  }> = [];

  if (carrierId && !(carriers ?? []).some((carrier) => carrier.id === carrierId)) {
    redirect("/freight-invoices?error=carrier");
  }

  if (ext === "csv") {
    lines = parseInvoiceCsv(await file.text());
    if (!lines.length) redirect("/freight-invoices?error=csv");
    if (!carrierId) redirect("/freight-invoices?error=carrier");
    if (!invoiceNumber) redirect("/freight-invoices?error=invoice-number");
    totalAmount = totalAmount ?? lines.reduce((sum, line) => sum + line.amount, 0);
    subtotal = totalAmount;
    currency = currency || "EUR";
    extractionData = { ...extractionData, extraction_method: "structured_csv", extracted_line_count: lines.length };
  } else {
    let extracted;
    try {
      extracted = await extractPdfInvoiceLite(buffer);
    } catch {
      redirect("/freight-invoices?error=pdf-read");
    }

    invoiceNumber = invoiceNumber || extracted.invoice_number;
    invoiceDate = invoiceDate || extracted.invoice_date;
    dueDate = extracted.due_date;
    currency = currency || extracted.currency || "EUR";
    subtotal = extracted.subtotal;
    taxAmount = extracted.tax_amount;
    totalAmount = totalAmount ?? extracted.total_amount;
    lines = extracted.lines;

    if (!carrierId) {
      const source = comparable(extracted.carrier_match_text);
      const match = (carriers ?? []).find((carrier) =>
        [carrier.name, carrier.carrier_code, carrier.vat_id]
          .map(comparable)
          .filter((value) => value.length >= 4)
          .some((value) => source.includes(value)),
      );
      carrierId = match?.id ?? null;
    }

    if (!lines.length && totalAmount != null) {
      lines = [{
        line_number: 1,
        description: "PDF-laskun kokonaissumma",
        charge_code: "BASE",
        quantity: 1,
        unit_price: totalAmount,
        amount: totalAmount,
        raw_data: {
          source: "pdf_fallback",
          page: null,
          extraction_confidence: 0.45,
          note: "Rivikohtaista tekstiä ei voitu tunnistaa.",
        },
      }];
    }

    extractionData = {
      ...extractionData,
      extraction_method: "pdf_text",
      page_count: extracted.page_count,
      extracted_line_count: lines.length,
      extracted_invoice_number: extracted.invoice_number,
      extracted_invoice_date: extracted.invoice_date,
      extracted_due_date: extracted.due_date,
      extracted_currency: extracted.currency,
      extracted_total_amount: extracted.total_amount,
      carrier_auto_matched: !providedCarrier && Boolean(carrierId),
    };
  }

  if (!carrierId) redirect("/freight-invoices?error=carrier-match");
  if (!invoiceNumber) redirect("/freight-invoices?error=invoice-number");
  if (!currency || currency.length !== 3) redirect("/freight-invoices?error=currency");
  if (totalAmount == null) redirect("/freight-invoices?error=total");

  const filePath = workspace.id + "/" + crypto.randomUUID() + "-" + safeName(file.name);
  const { error: storageError } = await supabase.storage.from("invoices").upload(filePath, buffer, {
    contentType: file.type || (ext === "pdf" ? "application/pdf" : "text/csv"),
    upsert: false,
  });
  if (storageError) redirect("/freight-invoices?error=upload");

  const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
    workspace_id: workspace.id,
    carrier_id: carrierId,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate,
    currency,
    subtotal: subtotal ?? totalAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    source_file_path: filePath,
    extraction_data: extractionData,
    status: "uploaded",
    created_by: userId,
  }).select("id").single();

  if (invoiceError || !invoice) {
    await supabase.storage.from("invoices").remove([filePath]);
    redirect("/freight-invoices?error=create");
  }

  const { error: lineError } = await supabase.from("invoice_lines").insert(
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

  if (lineError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    await supabase.storage.from("invoices").remove([filePath]);
    redirect("/freight-invoices?error=lines");
  }

  revalidatePath("/invoices");
  redirect("/invoices/" + invoice.id + "?message=uploaded");
}
