import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";
import { reviewFinding } from "./actions";

const typeNames: Record<string, string> = {
  duplicate_invoice: "Mahdollinen kaksoislasku",
  rate_mismatch: "Hintapoikkeama",
  fuel_surcharge: "Polttoainelisä",
  accessorial_fee: "Lisämaksu",
  shipment_mismatch: "Lähetyspoikkeama",
  tax_or_fx: "Vero / valuutta",
  other: "Muu poikkeama",
};

export default async function FindingsPage() {
  const { supabase, workspace } = await getCurrentWorkspace();

  const { data: findings } = await supabase
    .from("audit_findings")
    .select("id,audit_run_id,finding_type,severity,billed_amount,expected_amount,variance_amount,confidence,evidence,status,created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  const runIds = [...new Set((findings ?? []).map((finding) => finding.audit_run_id))];
  const { data: runs } = runIds.length
    ? await supabase
        .from("audit_runs")
        .select("id,invoice_id")
        .eq("workspace_id", workspace.id)
        .in("id", runIds)
    : { data: [] };

  const invoiceIds = [...new Set((runs ?? []).map((run) => run.invoice_id))];
  const { data: invoices } = invoiceIds.length
    ? await supabase
        .from("invoices")
        .select("id,invoice_number,carrier_id,currency")
        .eq("workspace_id", workspace.id)
        .in("id", invoiceIds)
    : { data: [] };

  const carrierIds = [...new Set((invoices ?? []).map((invoice) => invoice.carrier_id))];
  const { data: carriers } = carrierIds.length
    ? await supabase
        .from("carriers")
        .select("id,name")
        .eq("workspace_id", workspace.id)
        .in("id", carrierIds)
    : { data: [] };

  const runMap = new Map((runs ?? []).map((run) => [run.id, run]));
  const invoiceMap = new Map((invoices ?? []).map((invoice) => [invoice.id, invoice]));
  const carrierMap = new Map((carriers ?? []).map((carrier) => [carrier.id, carrier.name]));

  const openCount = (findings ?? []).filter((finding) => finding.status === "open").length;
  const openVariance = (findings ?? [])
    .filter((finding) => finding.status === "open")
    .reduce((sum, finding) => sum + Math.max(Number(finding.variance_amount ?? 0), 0), 0);

  return (
    <AppShell workspaceName={workspace.name} active="/findings">
      <header className="header">
        <div>
          <h1>Löydökset</h1>
          <p className="kicker">
            Tarkista auditointipoikkeamat ja hyväksy vain perustellut reklamaatiot.
          </p>
        </div>
      </header>

      <section className="grid compact-grid">
        <article className="card">
          <div className="metric-label">Avoimet löydökset</div>
          <div className="stat metric-danger">{openCount}</div>
          <p>Odottaa hyväksyntää tai hylkäystä.</p>
        </article>
        <article className="card">
          <div className="metric-label">Avoin poikkeama-arvo</div>
          <div className="stat">
            {new Intl.NumberFormat("fi-FI", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(openVariance)}
          </div>
          <p>Positiivisten poikkeamien yhteenlaskettu arvo.</p>
        </article>
      </section>

      <article className="panel findings-panel">
        <div className="section-heading">
          <div>
            <h2>Auditointilöydökset</h2>
            <p className="muted">{findings?.length ?? 0} löydöstä</p>
          </div>
        </div>

        <div className="findings-table">
          <div className="findings-row findings-head">
            <span>Lasku</span>
            <span>Poikkeama</span>
            <span>Laskutettu</span>
            <span>Odotettu</span>
            <span>Erotus</span>
            <span>Luottamus</span>
            <span>Tila</span>
            <span>Toiminnot</span>
          </div>

          {(findings ?? []).map((finding) => {
            const run = runMap.get(finding.audit_run_id);
            const invoice = run ? invoiceMap.get(run.invoice_id) : undefined;
            const evidence = (finding.evidence ?? {}) as Record<string, unknown>;
            const reason = typeof evidence.reason === "string" ? evidence.reason : "";
            const currency = invoice?.currency || "EUR";

            return (
              <div className="findings-row" key={finding.id}>
                <span>
                  <strong>{invoice?.invoice_number || "—"}</strong>
                  <small>{invoice ? carrierMap.get(invoice.carrier_id) : ""}</small>
                </span>
                <span>
                  <strong>{typeNames[finding.finding_type] || finding.finding_type}</strong>
                  <small>{reason}</small>
                </span>
                <span>{money(finding.billed_amount, currency)}</span>
                <span>{money(finding.expected_amount, currency)}</span>
                <span className={Number(finding.variance_amount) > 0 ? "money-danger" : ""}>
                  {money(finding.variance_amount, currency)}
                </span>
                <span>{finding.confidence == null ? "—" : `${Math.round(Number(finding.confidence) * 100)} %`}</span>
                <span className={`status ${finding.status === "accepted" ? "success" : ""}`}>
                  {statusName(finding.status)}
                </span>
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
                    <span className="muted">Käsitelty</span>
                  )}
                </span>
              </div>
            );
          })}

          {!findings?.length && (
            <div className="empty-state">Auditointilöydöksiä ei ole vielä.</div>
          )}
        </div>
      </article>
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

function statusName(status: string) {
  if (status === "open") return "Avoin";
  if (status === "accepted") return "Hyväksytty";
  if (status === "dismissed") return "Hylätty";
  if (status === "recovered") return "Takaisin saatu";
  return status;
}
