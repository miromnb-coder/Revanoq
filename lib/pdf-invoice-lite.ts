import { inflateSync } from "node:zlib";

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

function clean(value: string) {
  return value.replace(/\u0000/g, "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
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
    if (match?.[1]) return clean(match[1]);
  }
  return null;
}

function labeledMoney(text: string, labels: string[]) {
  const group = labels.join("|");
  const patterns = [
    new RegExp("(?:" + group + ")\\s*[:#-]?\\s*(?:EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN|€|\\$|£)?\\s*(-?[0-9][0-9 .,'’]*[0-9]|-?[0-9]+)", "i"),
    new RegExp("(?:" + group + ").{0,32}?(-?[0-9][0-9 .,'’]*[0-9]|-?[0-9]+)\\s*(?:EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN|€|\\$|£)", "i"),
  ];
  for (const pattern of patterns) {
    const n = parseMoney(text.match(pattern)?.[1]);
    if (n != null) return n;
  }
  return null;
}

function decodePdfLiteral(input: string) {
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = input[++i];
    if (next == null) break;
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "b") out += "\b";
    else if (next === "f") out += "\f";
    else if (next === "(" || next === ")" || next === "\\") out += next;
    else if (/[0-7]/.test(next)) {
      let oct = next;
      for (let j = 0; j < 2 && /[0-7]/.test(input[i + 1] ?? ""); j += 1) oct += input[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else out += next;
  }
  return out;
}

function decodeHex(hex: string) {
  const normalized = hex.replace(/\s/g, "");
  if (!normalized || normalized.length < 2) return "";
  const even = normalized.length % 2 ? normalized + "0" : normalized;
  const bytes: number[] = [];
  for (let i = 0; i < even.length; i += 2) {
    const n = Number.parseInt(even.slice(i, i + 2), 16);
    if (Number.isFinite(n)) bytes.push(n);
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return out;
  }
  return String.fromCharCode(...bytes);
}

function extractTextOperators(stream: string) {
  const chunks: string[] = [];
  const blocks = stream.match(/BT[\s\S]*?ET/g) ?? [];

  for (const block of blocks) {
    const tokenRe = /\((?:\\.|[^\\)])*\)|<([0-9A-Fa-f\s]+)>|\[(.*?)\]\s*TJ|T\*|Td|TD|Tm|Tj|'|"/gs;
    let match: RegExpExecArray | null;
    let pending = "";
    while ((match = tokenRe.exec(block))) {
      const token = match[0];
      if (token.startsWith("(")) {
        pending = decodePdfLiteral(token.slice(1, -1));
      } else if (token.startsWith("<") && !token.startsWith("<<")) {
        pending = decodeHex(match[1] ?? "");
      } else if (match[2] != null) {
        const arrayText = match[2];
        const parts = [...arrayText.matchAll(/\((?:\\.|[^\\)])*\)|<([0-9A-Fa-f\s]+)>/g)].map((m) =>
          m[0].startsWith("(") ? decodePdfLiteral(m[0].slice(1, -1)) : decodeHex(m[1] ?? ""),
        );
        if (parts.length) chunks.push(parts.join(""));
        pending = "";
      } else if (/Tj\s*$/.test(token) || token === "'" || token === '"') {
        if (pending) chunks.push(pending);
        pending = "";
      } else if (token === "T*" || token === "Td" || token === "TD" || token === "Tm") {
        if (chunks.length && chunks[chunks.length - 1] !== "\n") chunks.push("\n");
      }
    }
    chunks.push("\n");
  }

  return clean(chunks.join(" ").replace(/\s*\n\s*/g, "\n"));
}

function extractPdfText(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const pages = (raw.match(/\/Type\s*\/Page\b/g) ?? []).length || 1;
  const texts: string[] = [];
  const streamRe = /([\s\S]{0,700}?)stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRe.exec(raw))) {
    const dict = match[1];
    const bytes = Buffer.from(match[2], "latin1");
    let decoded = bytes;

    try {
      if (/\/FlateDecode/.test(dict)) decoded = inflateSync(bytes);
      else if (/\/ASCIIHexDecode/.test(dict)) {
        const hex = match[2].replace(/[^0-9A-Fa-f]/g, "");
        decoded = Buffer.from(hex.length % 2 ? hex + "0" : hex, "hex");
      }
    } catch {
      continue;
    }

    const value = extractTextOperators(decoded.toString("latin1"));
    if (value.length >= 3) texts.push(value);
  }

  if (!texts.length) {
    const fallback = extractTextOperators(raw);
    if (fallback) texts.push(fallback);
  }

  return { text: texts.join("\n"), pageCount: pages };
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

function extractLines(text: string): ExtractedPdfLine[] {
  const sourceLines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const result: ExtractedPdfLine[] = [];

  sourceLines.forEach((raw, sourceIndex) => {
    if (/^(subtotal|total|grand total|amount due|balance due|vat|tax|alv|yhteensä|veroton|laskun summa)/i.test(raw)) return;
    const amountMatch = raw.match(/(-?[0-9][0-9 .,'’]*[0-9]|-?[0-9]+)\s*(?:EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN|€|\$|£)?\s*$/i);
    const amount = parseMoney(amountMatch?.[1]);
    if (amount == null || Math.abs(amount) > 100000000) return;

    const before = amountMatch ? clean(raw.slice(0, amountMatch.index)) : raw;
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
    }

    let description = before.replace(/^([A-Z][A-Z0-9_.\/-]{1,18})\b/, "").trim();
    if (nums.length >= 2) {
      const cut = nums[nums.length - 2].index;
      if (cut > 3) description = clean(before.slice(0, cut)).replace(/^([A-Z][A-Z0-9_.\/-]{1,18})\b/, "").trim();
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
        page: null,
        source_line: sourceIndex + 1,
        raw_text: raw,
        extraction_confidence: chargeCode ? 0.84 : 0.62,
      },
    });
  });

  return result.slice(0, 1000);
}

export async function extractPdfInvoiceLite(buffer: Buffer): Promise<ExtractedPdfInvoice> {
  const extracted = extractPdfText(buffer);
  if (!extracted.text || extracted.text.length < 8) throw new Error("pdf_text_unavailable");
  const text = extracted.text;

  const invoiceNumber = firstMatch(text, [
    /(?:invoice\s*(?:no\.?|number|#)|lasku(?:numero|nro)?|faktura\s*(?:nr|no\.?)?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{2,})/i,
    /(?:document\s*(?:no\.?|number))\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{2,})/i,
  ]);

  const invoiceDate = firstMatch(text, [
    /(?:invoice\s*date|laskun\s*päivä|laskupäivä|datum)\s*[:#-]?\s*([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{1,4})/i,
  ]);
  const dueDate = firstMatch(text, [
    /(?:due\s*date|eräpäivä|forfallodatum)\s*[:#-]?\s*([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{1,4})/i,
  ]);

  const currency =
    firstMatch(text, [/(?:currency|valuutta)\s*[:#-]?\s*(EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN)\b/i])?.toUpperCase() ??
    text.match(/\b(EUR|USD|GBP|SEK|NOK|DKK|CHF|PLN)\b/i)?.[1]?.toUpperCase() ??
    (text.includes("€") ? "EUR" : text.includes("$") ? "USD" : text.includes("£") ? "GBP" : null);

  return {
    invoice_number: invoiceNumber,
    invoice_date: isoDate(invoiceDate),
    due_date: isoDate(dueDate),
    currency,
    subtotal: labeledMoney(text, ["subtotal", "net total", "veroton yhteensä", "veroton"]),
    tax_amount: labeledMoney(text, ["vat", "tax", "alv"]),
    total_amount: labeledMoney(text, ["grand total", "amount due", "invoice total", "total amount", "laskun summa", "maksettava", "yhteensä", "total"]),
    carrier_match_text: text.slice(0, 12000),
    lines: extractLines(text),
    page_count: extracted.pageCount,
  };
}
