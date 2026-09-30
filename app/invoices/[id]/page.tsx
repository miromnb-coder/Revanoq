import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";
import { reviewFinding } from "@/app/findings/actions";
import { runAudit } from "./actions";

const typeNames: Record<string, string> = {
  duplicate_invoice: "Mahdollinen kaksoislasku",
  rate_mismatch: "Hintapoikkeama",
  fuel_surcharge: "Polttoainelisä",
  accessorial_fee: "Lisämaksu",
  shipment_mismatch: "Lähetyspoikkeama",
  tax_or_fx: "Vero / valuutta",
  other: "Muu poikkeama",
};

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, workspace } = await getCurrentWorkspace();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id,carrier_id,invoice_number,invoice_date,due_date,currency,subtotal,tax_amount,total_amount,source_file_path,status,extraction_data,created_at")
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  const [{ data: carrier }, { data: lines }, { data: runs }] = await Promise.all([
    supabase
      .from("carriers")
      .select("id,name,carrier_code")
      .eq("workspace_id", workspace.id)
      .eq("id", invoice.carrier_id)
      .maybeSingle(),
    supabase
      .from("invoice_lines")
      .select("id,line_number,description,charge_code,quantity,unit_price,amount,raw_data")
      .eq("workspace_id", workspace.id)
      .eq("invoice_id", invoice.id)
      .order("line_number"),
    supabase
      .from("audit_runs")
      .select("id,status,engine_version,started_at,completed_at,summary,created_at")
      .eq("workspace_id", workspace.id)
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: false }),
  ]);

  const latestRun = runs?.[0];
  const { data: findings } = latestRun
    ? await supabase
        .from("audit_findings")
        .select("id,finding_type,severity,billed_amount,expected_amount,variance_amount,confidence,evidence,status")
        .eq("workspace_id", workspace.id)
        .eq("audit_run_id", latestRun.id)
        .order("variance_amount", { ascending: false })
    : { data: [] };

  let fileUrl: string | null = null;
  if (invoice.source_file_path) {
    const { data } = await supabase.storage
      .from("invoices")
      .createSignedUrl(invoice.source_file_path, 600);
    fileUrl = data?.signedUrl ?? null;
  }

  const summary = (latestRun?.summary ?? {}) as Record<string, unknown>;
  const extraction = (invoice.extraction_data ?? {}) as Record<string, unknown>;
  const totalVariance = Number(summary.total_variance ?? 0);

  return (
    <AppShell workspaceName={workspace.name} active="/freight-invoices">
      <div className="breadcrumbs">
        <Link href="/freight-invoices">Laskut</Link>
        <span>/</span>
        <span>{invoice.invoice_number}</span>
      </div>

      <header className="header">
        <div>
          <h1>Lasku {invoice.invoice_number}</h1>
          <p className="kicker">
            {carrier?.name || "Kuljetusyhtiö"} · {invoice.invoice_date || "ei laskupäivää"} · {invoice.status}
          </p>
        </div>

        <div className="header-actions">
          {fileUrl && (
            <a className="button" href={fileUrl} target="_blank" rel="noreferrer">
              Avaa alkuperäinen tiedosto
            </a>
          )}
          <form action={runAudit}>
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <button className="button primary" type="submit">
              {latestRun ? "Aja auditointi uudelleen" : "Käynnistä auditointi"}
            </button>
          </form>
        </div>
      </header>

      {query.message === "uploaded" && (
        <div className="notice">Lasku ja laskurivit tallennettiin onnistuneesti.</div>
      )}
      {query.message === "audited" && (
        <div className="notice">Auditointi valmistui.</div>
      )}
      {query.error && (
        <div className="notice error">Auditoinnin käynnistäminen epäonnistui.</div>
      )}

      <section className="grid">
        <article className="card">
          <div className="metric-label">Laskun summa</div>
          <div className="stat">{money(invoice.total_amount, invoice.currency)}</div>
          <p>{lines?.length ?? 0} laskuriviä</p>
        </article>

        <article className="card">
          <div className="metric-label">Löydökset</div>
          <div className="stat metric-danger">{findings?.length ?? 0}</div>
          <p>Viimeisimmän auditoinnin poikkeamat.</p>
        </article>

        <article className="card">
          <div className="metric-label">Poikkeama-arvo</div>
          <div className={`stat ${totalVariance > 0 ? "metric-danger" : ""}`}>
            {money(totalVariance, invoice.currency)}
          </div>
          <p>Viimeisimmän auditointiajon yhteenlaskettu erotus.</p>
        </article>

        <article className="card">
          <div className="metric-label">Auditoinnin tila</div>
          <div className="stat small-stat">{latestRun?.status === "completed" ? "Valmis" : "Ei ajettu"}</div>
          <p>{latestRun?.engine_version ? `Moottori ${latestRun.engine_version}` : "Auditointia ei ole vielä käynnistetty."}</p>
        </article>
      </section>

      {latestRun && typeof summary.note === "string" && summary.note && (
        <div className="notice warning-notice">{summary.note}</div>
      )}

      {extraction.extraction_method && (
        <div className="extraction-strip">
          <div>
            <span className="metric-label">Poimintatapa</span>
            <strong>{extraction.extraction_method === "pdf_text" ? "PDF · automaattinen" : "CSV · rakenteinen"}</strong>
          </div>
          <div>
            <span className="metric-label">Poimitut rivit</span>
            <strong>{String(extraction.extracted_line_count ?? lines?.length ?? 0)}</strong>
          </div>
          <div>
            <span className="metric-label">Sivuja</span>
            <strong>{String(extraction.page_count ?? "—")}</strong>
          </div>
          <div>
            <span className="metric-label">Kuljetusyhtiö</span>
            <strong>{extraction.carrier_auto_matched ? "Tunnistettu automaattisesti" : "Valittu / vahvistettu"}</strong>
          </div>
        </div>
      )}

      <section className="panel invoice-lines-panel">
        <div className="section-heading">
          <div>
            <h2>Laskurivit</h2>
            <p className="muted">Auditoinnissa käytettävä laskudata.</p>
          </div>
        </div>

        <div className="data-table">
          <div className="data-row data-head">
            <span>Rivi</span>
            <span>Veloituskoodi</span>
            <span>Selite / lähde</span>
            <span>Määrä</span>
            <span>Yksikköhinta</span>
            <span>Summa</span>
          </div>

          {(lines ?? []).map((line) => (
            <div className="data-row" key={line.id}>
              <span>{line.line_number ?? "—"}</span>
              <span><code>{line.charge_code || "—"}</code></span>
              <span>
                {line.description || "—"}
                {(() => {
                  const source = (line.raw_data ?? {}) as Record<string, unknown>;
                  if (source.source !== "pdf_text") return null;
                  const confidence = Number(source.extraction_confidence ?? 0);
                  return (
                    <small className="source-evidence">
                      PDF-lähde{source.page ? ` · s. ${source.page}` : ""}{confidence ? ` · ${Math.round(confidence * 100)} %` : ""}
                    </small>
                  );
                })()}
              </span>
              <span>{line.quantity ?? "—"}</span>
              <span>{money(line.unit_price, invoice.currency)}</span>
              <span><strong>{money(line.amount, invoice.currency)}</strong></span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel findings-panel">
        <div className="section-heading">
          <div>
            <h2>Auditointilöydökset</h2>
            <p className="muted">
              Laskutettu summa verrattuna sopimuksen perusteella odotettuun hintaan.
            </p>
          </div>
          <Link className="button" href="/findings">Kaikki löydökset</Link>
        </div>

        <div className="findings-table">
          <div className="findings-row findings-head">
            <span>Poikkeama</span>
            <span>Laskutettu</span>
            <span>Odotettu</span>
            <span>Erotus</span>
            <span>Peruste</span>
            <span>Luottamus</span>
            <span>Toiminnot</span>
          </div>

          {(findings ?? []).map((finding) => {
            const evidence = (finding.evidence ?? {}) as Record<string, unknown>;
            const reason = typeof evidence.reason === "string" ? evidence.reason : "—";

            return (
              <div className="findings-row invoice-finding-row" key={finding.id}>
                <span>
                  <strong>{typeNames[finding.finding_type] || finding.finding_type}</strong>
                  <small className={`severity ${finding.severity}`}>{finding.severity}</small>
                </span>
                <span>{money(finding.billed_amount, invoice.currency)}</span>
                <span>{money(finding.expected_amount, invoice.currency)}</span>
                <span className={Number(finding.variance_amount) > 0 ? "money-danger" : ""}>
                  <strong>{money(finding.variance_amount, invoice.currency)}</strong>
                </span>
                <span><small>{reason}</small></span>
                <span>{finding.confidence == null ? "—" : `${Math.round(Number(finding.confidence) * 100)} %`}</span>
                <span>
                  {finding.status === "open" ? (
                    <form className="inline-actions" action={reviewFinding}>
                      <input type="hidden" name="finding_id" value={finding.id} />
                      <button className="button mini primary" name="decision" value="accepted">
                        Hyväksy
                      </button>
                      <button className="button mini" name="decision" value="dismissed">
                        Hylkää
                      </button>
                    </form>
                  ) : (
                    <span className={`status ${finding.status === "accepted" ? "success" : ""}`}>
                      {finding.status === "accepted" ? "Hyväksytty" : "Hylätty"}
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          {latestRun && !findings?.length && (
            <div className="empty-state">Auditointi ei löytänyt poikkeamia.</div>
          )}
          {!latestRun && (
            <div className="empty-state">
              Auditointia ei ole vielä ajettu. Käynnistä se oikeasta yläkulmasta.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function money(value: number | string | null, currency: string) {
  if (value == null) return "—";
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency,
  }).format(Number(value));
}
