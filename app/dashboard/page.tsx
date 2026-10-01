import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { createWorkspace } from "./actions";
import { AppShell } from "@/components/app-shell";

const findingNames: Record<string, string> = {
  duplicate_invoice: "Duplikaattilasku",
  rate_mismatch: "Hintapoikkeama",
  fuel_surcharge: "Polttoainelisä",
  accessorial_fee: "Lisämaksu",
  shipment_mismatch: "Lähetyspoikkeama",
  tax_or_fx: "Vero / valuutta",
  other: "Muu poikkeama",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) redirect("/login");

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id,name,slug")
    .order("created_at", { ascending: true });

  const workspace = workspaces?.[0];

  if (!workspace) {
    return (
      <main className="site-shell">
        <div className="shell">
          <nav className="nav">
            <div className="brand">REVANOQ</div>
            <form action={logout}>
              <button className="button" type="submit">Kirjaudu ulos</button>
            </form>
          </nav>
          <form className="form" action={createWorkspace}>
            <div>
              <div className="eyebrow">Työtilan käyttöönotto</div>
              <h1>Luo työtila</h1>
              <p className="muted">
                Aloita yhdellä yrityksen työtilalla. Kuljetusyhtiöt, sopimukset,
                laskut ja auditointilöydökset pysyvät sen sisällä.
              </p>
            </div>
            {params.error && <div className="notice error">Työtilan luominen epäonnistui. Kokeile toista nimeä.</div>}
            <label>
              Yrityksen tai työtilan nimi
              <input name="name" type="text" minLength={2} maxLength={120} placeholder="Esimerkki Teollisuus Oy" required />
            </label>
            <button className="button primary" type="submit">Luo työtila</button>
          </form>
        </div>
      </main>
    );
  }

  const [invoicesResult, findingsResult, disputesResult, carriersResult, runsResult] = await Promise.all([
    supabase.from("invoices").select("id,carrier_id,invoice_number,invoice_date,total_amount,currency,status,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
    supabase.from("audit_findings").select("id,audit_run_id,finding_type,billed_amount,expected_amount,variance_amount,confidence,status,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
    supabase.from("disputes").select("id,disputed_amount,credited_amount,status").eq("workspace_id", workspace.id),
    supabase.from("carriers").select("id,name").eq("workspace_id", workspace.id),
    supabase.from("audit_runs").select("id,invoice_id").eq("workspace_id", workspace.id),
  ]);

  const invoices = invoicesResult.data ?? [];
  const findings = findingsResult.data ?? [];
  const disputes = disputesResult.data ?? [];
  const carriers = carriersResult.data ?? [];
  const runs = runsResult.data ?? [];

  const auditedAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const discrepancyAmount = findings.filter((finding) => finding.status !== "dismissed").reduce((sum, finding) => sum + Math.max(Number(finding.variance_amount ?? 0), 0), 0);
  const claimedAmount = disputes.filter((dispute) => dispute.status !== "rejected" && dispute.status !== "closed").reduce((sum, dispute) => sum + Number(dispute.disputed_amount ?? 0), 0);
  const recoveredAmount = disputes.filter((dispute) => dispute.status === "credited").reduce((sum, dispute) => sum + Number(dispute.credited_amount ?? 0), 0);

  const runMap = new Map<string, string>(runs.map((run) => [String(run.id), String(run.invoice_id)] as [string, string]));
  const invoiceMap = new Map(invoices.map((invoice) => [String(invoice.id), invoice]));
  const carrierMap = new Map<string, string>(carriers.map((carrier) => [String(carrier.id), String(carrier.name)] as [string, string]));

  const recentFindings = findings.slice(0, 5).map((finding) => {
    const invoiceId = runMap.get(finding.audit_run_id);
    const invoice = invoiceId ? invoiceMap.get(invoiceId) : undefined;
    return { ...finding, invoice, carrierName: invoice ? carrierMap.get(invoice.carrier_id) : undefined };
  });

  const carrierTotals = new Map<string, number>();
  for (const finding of findings) {
    if (finding.status === "dismissed") continue;
    const invoiceId = runMap.get(finding.audit_run_id);
    const invoice = invoiceId ? invoiceMap.get(invoiceId) : undefined;
    if (!invoice) continue;
    const name = carrierMap.get(invoice.carrier_id) || "Tuntematon";
    carrierTotals.set(name, (carrierTotals.get(name) ?? 0) + Math.max(Number(finding.variance_amount ?? 0), 0));
  }

  const carrierRanking: Array<[string, number]> = [...carrierTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const carrierMax = Math.max(...carrierRanking.map(([, amount]) => amount), 1);

  const findingTypeTotals = new Map<string, number>();
  for (const finding of findings) {
    if (finding.status === "dismissed") continue;
    const amount = Math.max(Number(finding.variance_amount ?? 0), 0);
    findingTypeTotals.set(finding.finding_type, (findingTypeTotals.get(finding.finding_type) ?? 0) + amount);
  }

  const typeRanking: Array<[string, number]> = [...findingTypeTotals.entries()].sort((a, b) => b[1] - a[1]);
  const displayTypeRanking: Array<[string, number]> = typeRanking.length
    ? typeRanking
    : [["rate_mismatch", 0], ["fuel_surcharge", 0], ["accessorial_fee", 0]];
  const typeTotal = Math.max(typeRanking.reduce((sum, [, value]) => sum + value, 0), 1);
  const monthBars = buildMonthBars(invoices, findings, runMap);

  return (
    <AppShell workspaceName={workspace.name} active="/dashboard">
      <header className="header dashboard-header">
        <div>
          <div className="page-label">Auditointi</div>
          <h1>Auditoinnin yleiskuva</h1>
          <p className="kicker">Näe rahtikulujen poikkeamat, reklamoitu arvo ja takaisin saadut hyvitykset.</p>
        </div>
        <div className="period-control"><span>◫</span><strong>Viimeiset 9 kk</strong><span>⌄</span></div>
      </header>

      <section className="dashboard-kpis">
        <Kpi label="Auditoitu" value={money(auditedAmount)} trend="Laskutettu arvo" spark={[28,42,35,58,49,73,65]} />
        <Kpi label="Poikkeamat" value={money(discrepancyAmount)} trend={`${findings.filter((f) => f.status === "open").length} avointa`} spark={[18,25,22,36,32,49,44]} tone="warning" />
        <Kpi label="Reklamoitu" value={money(claimedAmount)} trend={`${disputes.length} reklamaatiota`} spark={[12,18,17,26,23,38,42]} />
        <Kpi label="Hyvitetty" value={money(recoveredAmount)} trend="Todellinen säästö" spark={[8,10,16,15,22,30,39]} tone="success" />
      </section>

      <section className="dashboard-primary">
        <article className="dashboard-panel trend-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">Kehitys</span><h2>Auditoitu vs. poikkeamat</h2></div>
            <div className="chart-legend"><span><i className="legend-light" /> Auditoitu</span><span><i className="legend-dark" /> Poikkeamat</span></div>
          </div>
          <div className="audit-chart">
            {monthBars.map((month) => (
              <div className="chart-month" key={month.label}>
                <div className="chart-bars">
                  <span className="chart-bar audited" style={{ height: `${month.audited}%` }} />
                  <span className="chart-bar discrepancy" style={{ height: `${month.discrepancy}%` }} />
                </div>
                <small>{month.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel breakdown-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Jakauma</span><h2>Poikkeamat tyypeittäin</h2></div></div>
          <div className="breakdown-content">
            <div className="donut-chart"><div><strong>{money(discrepancyAmount)}</strong><span>yhteensä</span></div></div>
            <div className="breakdown-list">
              {displayTypeRanking.slice(0, 5).map(([type, amount], index) => (
                <div key={type}><span><i className={`dot dot-${index + 1}`} /> {findingNames[type] || type}</span><strong>{Math.round((amount / typeTotal) * 100)} %</strong></div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-secondary">
        <article className="dashboard-panel carrier-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Kuljetusyhtiöt</span><h2>Poikkeamat kuljetusyhtiöittäin</h2></div></div>
          <div className="carrier-ranking">
            {(carrierRanking.length ? carrierRanking : carriers.slice(0, 5).map((carrier) => [carrier.name, 0] as [string, number])).map(([name, amount]) => (
              <div className="carrier-rank-row" key={name}>
                <span>{name}</span><strong>{money(amount)}</strong>
                <div className="carrier-bar"><i style={{ width: `${Math.max((amount / carrierMax) * 100, amount ? 5 : 0)}%` }} /></div>
              </div>
            ))}
            {!carriers.length && <div className="empty-state compact-empty">Ei kuljetusyhtiöitä vielä.</div>}
          </div>
        </article>

        <article className="dashboard-panel workflow-panel">
          <div className="panel-heading"><div><span className="panel-kicker">Prosessi</span><h2>Auditoinnin tila</h2></div></div>
          <div className="workflow-steps">
            <div><span>01</span><strong>Lasku tuotu</strong><b>{invoices.length}</b></div>
            <div><span>02</span><strong>Löydös tunnistettu</strong><b>{findings.length}</b></div>
            <div><span>03</span><strong>Reklamaatio luotu</strong><b>{disputes.length}</b></div>
            <div><span>04</span><strong>Hyvitys saatu</strong><b>{disputes.filter((d) => d.status === "credited").length}</b></div>
          </div>
        </article>
      </section>

      <article className="dashboard-panel recent-panel">
        <div className="panel-heading">
          <div><span className="panel-kicker">Viimeisimmät</span><h2>Auditointilöydökset</h2></div>
          <a className="button button-quiet" href="/findings">Näytä kaikki</a>
        </div>
        <div className="recent-table">
          <div className="recent-row recent-head">
            <span>Päivä</span><span>Lasku</span><span>Kuljetusyhtiö</span><span>Tyyppi</span><span>Laskutettu</span><span>Odotettu</span><span>Erotus</span><span>Tila</span>
          </div>
          {recentFindings.map((finding) => (
            <div className="recent-row" key={finding.id}>
              <span>{shortDate(finding.created_at)}</span>
              <span><strong>{finding.invoice?.invoice_number || "—"}</strong></span>
              <span>{finding.carrierName || "—"}</span>
              <span>{findingNames[finding.finding_type] || finding.finding_type}</span>
              <span>{money(finding.billed_amount)}</span>
              <span>{money(finding.expected_amount)}</span>
              <span className="money-danger"><strong>{signedMoney(finding.variance_amount)}</strong></span>
              <span><Status status={finding.status} /></span>
            </div>
          ))}
          {!recentFindings.length && <div className="empty-state">Auditointilöydöksiä ei ole vielä. Tuo lasku ja käynnistä auditointi.</div>}
        </div>
      </article>
    </AppShell>
  );
}

function Kpi({ label, value, trend, spark, tone }: { label: string; value: string; trend: string; spark: number[]; tone?: "warning" | "success" }) {
  return (
    <article className="dashboard-kpi">
      <div className="metric-label">{label}</div>
      <div className="dashboard-kpi-value">{value}</div>
      <div className={`kpi-trend ${tone ?? ""}`}>{trend}</div>
      <div className="sparkline" aria-hidden="true">{spark.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
    </article>
  );
}

function Status({ status }: { status: string }) {
  const name = status === "open" ? "Tarkista" : status === "accepted" ? "Hyväksytty" : status === "dismissed" ? "Hylätty" : status === "recovered" ? "Hyvitetty" : status;
  return <span className={`status ${status === "recovered" || status === "accepted" ? "success" : ""}`}>{name}</span>;
}

function buildMonthBars(
  invoices: Array<{ id: string; total_amount: number | string | null; created_at: string }>,
  findings: Array<{ audit_run_id: string; variance_amount: number | string | null; status: string; created_at: string }>,
  runMap: Map<string, string>,
) {
  const now = new Date();
  const months = Array.from({ length: 9 }, (_, offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (8 - offset), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("fi-FI", { month: "short" }).format(d).replace(".", ""),
      auditedRaw: 0,
      discrepancyRaw: 0,
    };
  });

  const index = new Map(months.map((month) => [month.key, month]));

  for (const invoice of invoices) {
    const d = new Date(invoice.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const month = index.get(key);
    if (month) month.auditedRaw += Number(invoice.total_amount ?? 0);
  }

  for (const finding of findings) {
    if (finding.status === "dismissed" || !runMap.has(finding.audit_run_id)) continue;
    const d = new Date(finding.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const month = index.get(key);
    if (month) month.discrepancyRaw += Math.max(Number(finding.variance_amount ?? 0), 0);
  }

  const maxAudited = Math.max(...months.map((month) => month.auditedRaw), 1);
  const maxDiscrepancy = Math.max(...months.map((month) => month.discrepancyRaw), 1);

  return months.map((month) => ({
    label: month.label,
    audited: Math.max((month.auditedRaw / maxAudited) * 100, month.auditedRaw ? 8 : 2),
    discrepancy: Math.max((month.discrepancyRaw / maxDiscrepancy) * 55, month.discrepancyRaw ? 6 : 2),
  }));
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function signedMoney(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return `${number > 0 ? "+" : ""}${money(number)}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("fi-FI", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
