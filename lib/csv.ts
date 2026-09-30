export type CsvInvoiceLine = {
  line_number: number;
  description: string | null;
  charge_code: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  raw_data: Record<string, string>;
};

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function numberValue(value?: string) {
  if (!value?.trim()) return null;
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/,(?=\d{1,4}$)/, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseInvoiceCsv(text: string): CsvInvoiceLine[] {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized) return [];

  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter =
    (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const headers = splitCsvLine(lines[0], delimiter).map((header) =>
    header.trim().toLowerCase().replace(/[\s-]+/g, "_"),
  );

  const find = (record: Record<string, string>, names: string[]) => {
    for (const name of names) {
      if (record[name] != null) return record[name];
    }
    return "";
  };

  return lines.slice(1).flatMap((line, index) => {
    const values = splitCsvLine(line, delimiter);
    const record = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));

    const amount = numberValue(find(record, ["amount", "sum", "total", "line_total", "rivisumma"]));
    if (amount == null) return [];

    return [{
      line_number: Number(find(record, ["line_number", "line", "rivi"])) || index + 1,
      description: find(record, ["description", "desc", "selite", "kuvaus"]) || null,
      charge_code:
        find(record, ["charge_code", "chargecode", "code", "veloituskoodi", "koodi"])
          .trim()
          .toUpperCase() || null,
      quantity: numberValue(find(record, ["quantity", "qty", "maara", "määrä"])),
      unit_price: numberValue(find(record, ["unit_price", "unitprice", "price", "yksikkohinta"])),
      amount,
      raw_data: record,
    }];
  });
}
