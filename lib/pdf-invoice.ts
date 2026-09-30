"use server";

import type { Buffer } from "node:buffer";
// @ts-expect-error pdf-parse 1.x does not ship TypeScript declarations.
import pdfParse from "pdf-parse";

export type ExtractedPdfLine = {
  line_number: number;
  description: string | null;
  charge_code: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  raw_data: {
    source: "pdf_text";
    page: number | null;
    source_line: number;
    raw_text: string;
    extraction_confidence: number;
  };
};

export type ExtractedPdfInvoice = {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  carrier_match_text: string;
  lines: ExtractedPdfLine[];
  page_count: number;
};

function cleanText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function normalized(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9åäö€$£]+/g, " ");
}

function parseMoney(value?: string | null) {
  if (!value) return null;
  let v = value.replace(/[€$£]/g, "").replace(/\s/g, "").trim();
  const comma = v.lastIndexOf(",");
  const dot = v.lastIndexOf(".");

  if (comma > dot) v = v.replace(/\./g, "").replace(",", ".");
  else if (dot > comma) v = v.replace(/,/g, "");
  else v = v.replace(",", ".");

  v = v.replace(/[^0-9.-]/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isoDate(value?: string | null) {
  if (!value) return null;
  let m = value.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");

  m = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");

  return null;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return null;
}

function labeledMoney(text: string, labels: string[]) {
  const group = labels.join("|");
  const patterns = [
    new RegExp("(?:" + group + ")\\s*[:#-]?\\s*(?:EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN|€|\\$|£)?\\s*(-?[0-9][0-9 .,'’]*[0-9]|-?[0-9]+)", "i"),
    new RegExp("(?:" + group + ").{0,24}?(-?[0-9][0-9 .,'’]*[0-9]|-?[0-9]+)\\s*(?:EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN|€|\\$|£)", "i"),
  ];

  for (const pattern of patterns) {
    const amount = parseMoney(text.match(pattern)?.[1]);
    if (amount != null) return amount;
  }
  return null;
}

function inferCode(description: string, explicit: string | null) {
  if (explicit) return explicit.toUpperCase();
  const s = description.toLowerCase();
  if (/fuel|polttoaine|diesel|baf\b/.test(s)) return "FUEL";
  if (/freight|transport|shipping|linehaul|rahti|kuljetus/.test(s)) return "BASE";
  if (/liftgate|tail lift|perälauta/.test(s)) return "LIFTGATE";
  if (/waiting|odotus/.test(s)) return "WAITING";
  if (/handling|käsittely/.test(s)) return "HANDLING";
  return null;
}

function summaryLine(value: string) {
  return /^(subtotal|total|grand total|amount due|balance due|vat|tax|alv|yhteensä|veroton|laskun summa)/i.test(value);
}

function pageForLine(line: string, pages: string[]) {
  const needle = normalized(line).slice(0, 80);
  if (needle.length < 8) return null;
  for (let i = 0; i < pages.length; i += 1) {
    if (normalized(pages[i]).includes(needle)) return i + 1;
  }
  return null;
}

function extractLines(text: string, pages: string[]) {
  const sourceLines = text.split(/\r?\n/).map(cleanText).filter(Boolean);
  const result: ExtractedPdfLine[] = [];

  sourceLines.forEach((raw, sourceIndex) => {
    if (raw.length < 4 || summaryLine(raw)) return;

    const amountMatch = raw.match(/(-?[0-9][0-9 .,'’]*[0-9]|-?[0-9]+)\s*(?:EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN|€|\$|£)?\s*$/i);
    const amount = parseMoney(amountMatch?.[1]);
    if (amount == null || Math.abs(amount) > 100000000) return;

    const before = amountMatch ? cleanText(raw.slice(0, amountMatch.index)) : raw;
    if (before.length < 2) return;

    const explicit = before.match(/^([A-Z][A-Z0-9_.\/-]{1,18})\b/)?.[1] ?? null;
    const nums = [...before.matchAll(/-?[0-9]+(?:[.,][0-9]+)?/g)]
      .map((m) => ({ value: parseMoney(m[0]), index: m.index ?? 0 }))
      .filter((x): x is { value: number; index: number } => x.value != null);

    let quantity: number | null = null;
    let unitPrice: number | null = null;
    if (nums.length >= 2) {
      quantity = nums[nums.length - 2].value;
      unitPrice = nums[nums.length - 1].value;
    } else if (nums.length === 1 && nums[0].value > 0 && nums[0].value <= 10000) {
      quantity = nums[0].value;
    }

    let description = before.replace(/^([A-Z][A-Z0-9_.\/-]{1,18})\b/, "").trim();
    if (nums.length) {
      const cut = nums[Math.max(0, nums.length - 2)].index;
      if (cut > 3) description = cleanText(before.slice(0, cut)).replace(/^([A-Z][A-Z0-9_.\/-]{1,18})\b/, "").trim();
    }

    const chargeCode = inferCode(description, explicit);
    if (!description && !chargeCode) return;

    result.push({
      line_number: result.length + 1,
      description: description || chargeCode,
      charge_code: chargeCode,
      quantity,
      unit_price: unitPrice,
      amount,
      raw_data: {
        source: "pdf_text",
        page: pageForLine(raw, pages),
        source_line: sourceIndex + 1,
        raw_text: raw,
        extraction_confidence: chargeCode ? 0.88 : 0.68,
      },
    });
  });

  return result.slice(0, 1000);
}

export async function extractPdfInvoice(buffer: Buffer): Promise<ExtractedPdfInvoice> {
  const base = await pdfParse(buffer);

  let pageNo = 0;
  const pageData = await pdfParse(buffer, {
    pagerender: async (page: { getTextContent(): Promise<{ items: Array<{ str?: string }> }> }) => {
      pageNo += 1;
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str ?? "").join(" ");
      return "[[REVANOQ_PAGE_" + pageNo + "]] " + cleanText(text);
    },
  });

  const raw = base.text.replace(/\r/g, "\n");
  const flat = cleanText(raw.replace(/\n +/g, "\n"));
  const pages = pageData.text
    .split(/\[\[REVANOQ_PAGE_\d+\]\]/)
    .map(cleanText)
    .filter(Boolean);

  const invoiceNumber = firstMatch(flat, [
    /(?:invoice\s*(?:no\.?|number|#)|lasku(?:numero|nro)?|faktura\s*(?:nr|no\.?)?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{2,})/i,
    /(?:document\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{2,})/i,
  ]);

  const invoiceDateValue = firstMatch(flat, [
    /(?:invoice\s*date|laskun\s*päivä|laskupäivä|datum)\s*[:#-]?\s*([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{1,4})/i,
  ]);

  const dueDateValue = firstMatch(flat, [
    /(?:due\s*date|eräpäivä|forfallodatum)\s*[:#-]?\s*([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{1,4})/i,
  ]);

  const currency =
    firstMatch(flat, [/(?:currency|valuutta)\s*[:#-]?\s*(EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN)\b/i])?.toUpperCase() ??
    flat.match(/\b(EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN)\b/i)?.[1]?.toUpperCase() ??
    (flat.includes("€") ? "EUR" : flat.includes("$") ? "USD" : flat.includes("£") ? "GBP" : null);

  return {
    invoice_number: invoiceNumber,
    invoice_date: isoDate(invoiceDateValue),
    due_date: isoDate(dueDateValue),
    currency,
    subtotal: labeledMoney(flat, ["subtotal", "net total", "veroton yhteensä", "veroton"]),
    tax_amount: labeledMoney(flat, ["vat", "tax", "alv"]),
    total_amount: labeledMoney(flat, ["grand total", "amount due", "invoice total", "total amount", "laskun summa", "maksettava", "yhteensä", "total"]),
    carrier_match_text: flat.slice(0, 12000),
    lines: extractLines(base.text, pages),
    page_count: base.numpages,
  };
}
