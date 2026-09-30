import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";
import { saveDisputeDraft, setDisputeProgress } from "../actions";

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await getCurrentWorkspace();

  const { data: dispute } = await supabase
    .from("disputes")
    .select("id,audit_finding_id,carrier_id,status,disputed_amount,credited_amount,recipient_email,subject,body,sent_at,resolved_at,resolution_note,created_at")
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .maybeSingle();

  if (!dispute) notFound();

  const [{ data: carrier }, { data: finding }] = await Promise.all([
    supabase
      .from("carriers")
      .select("id,name,contact_email")
      .eq("workspace_id", workspace.id)
      .eq("id", dispute.carrier_id)
      .maybeSingle(),
    supabase
      .from("audit_findings")
      .select("id,audit_run_id,billed_amount,expected_amount,variance_amount,confidence,evidence")
      .eq("workspace_id", workspace.id)
      .eq("id", dispute.audit_finding_id)
      .maybeSingle(),
  ]);

  const { data: run } = finding
    ? await supabase
        .from("audit_runs")
        .select("invoice_id")
        .eq("workspace_id", workspace.id)
        .eq("id", finding.audit_run_id)
        .maybeSingle()
    : { data: null };

  const { data: invoice } = run
    ? await supabase
        .from("invoices")
        .select("id,invoice_number,currency")
        .eq("workspace_id", workspace.id)
        .eq("id", run.invoice_id)
        .maybeSingle()
    : { data: null };

  const evidence = (finding?.evidence ?? {}) as Record<string, unknown>;
  const reason = typeof evidence.reason === "string" ? evidence.reason : "Auditointipoikkeama";
  const currency = invoice?.currency || "EUR";
  const recipient = dispute.recipient_email || carrier?.contact_email || "";
  const subject = dispute.subject || ("Rahtilaskun " + (invoice?.invoice_number || "") + " poikkeama");
  const body = dispute.body || buildDraft(
    invoice?.invoice_number || "—",
    reason,
    finding?.billed_amount,
    finding?.expected_amount,
    finding?.variance_amount,
    currency,
  );

  return (
    <AppShell workspaceName={workspace.name} active="/disputes">
      <div className="breadcrumbs">
        <Link href="/disputes">Reklamaatiot</Link>
        <span>/</span>
        <span>{invoice?.invoice_number || "Reklamaatio"}</span>
      </div>

      <header className="header">
        <div>
          <h1>{subject}</h1>
          <p className="kicker">{carrier?.name || "Kuljetusyhtiö"} · {label(dispute.status)}</p>
        </div>
        <div className="header-actions">
          <Link className="button" href={"/disputes/" + id + "/pdf"} target="_blank">
            Avaa PDF
          </Link>
          <Link className="button primary" href={"/disputes/" + id + "/email"}>
            Avaa sähköpostiluonnos
          </Link>
        </div>
      </header>

      <section className="grid">
        <article className="card">
          <div className="metric-label">Reklamoitava</div>
          <div className="stat">{money(dispute.disputed_amount, currency)}</div>
          <p>Vaadittava hyvitys.</p>
        </article>
        <article className="card">
          <div className="metric-label">Laskutettu</div>
          <div className="stat">{money(finding?.billed_amount, currency)}</div>
          <p>Laskulla veloitettu.</p>
        </article>
        <article className="card">
          <div className="metric-label">Odotettu</div>
          <div className="stat">{money(finding?.expected_amount, currency)}</div>
          <p>Sopimuksen mukainen.</p>
        </article>
        <article className="card">
          <div className="metric-label">Hyvitetty</div>
          <div className="stat metric-success">{money(dispute.credited_amount, currency)}</div>
          <p>Todellinen takaisin saatu summa.</p>
        </article>
      </section>

      <section className="content-grid dispute-grid">
        <article className="panel">
          <h2>Reklamaatioluonnos</h2>
          <p className="muted">Muokkaa vastaanottajaa, otsikkoa ja viestiä ennen lähettämistä.</p>

          <form className="stack-form" action={saveDisputeDraft}>
            <input type="hidden" name="dispute_id" value={dispute.id} />
            <label>
              Vastaanottaja
              <input name="recipient_email" type="email" defaultValue={recipient} />
            </label>
            <label>
              Otsikko
              <input name="subject" defaultValue={subject} />
            </label>
            <label>
              Viesti
              <textarea className="text-area" name="body" defaultValue={body} rows={14} />
            </label>
            <button className="button primary" type="submit">Tallenna luonnos</button>
          </form>
        </article>

        <article className="panel">
          <h2>Peruste ja eteneminen</h2>
          <div className="dispute-evidence">
            <span className="metric-label">Peruste</span>
            <strong>{reason}</strong>
            <p>Confidence {finding?.confidence == null ? "—" : Math.round(Number(finding.confidence) * 100) + " %"}</p>
          </div>

          <form className="stack-form" action={setDisputeProgress}>
            <input type="hidden" name="dispute_id" value={dispute.id} />
            <label>
              Hyvitetty summa
              <input name="credited_amount" inputMode="decimal" defaultValue={dispute.credited_amount ?? dispute.disputed_amount ?? ""} />
            </label>
            <label>
              Ratkaisun muistiinpano
              <textarea className="text-area" name="resolution_note" defaultValue={dispute.resolution_note ?? ""} rows={5} />
            </label>
            <div className="workflow-actions">
              <button className="button" name="status" value="sent">Lähetetty</button>
              <button className="button" name="status" value="accepted">Hyväksytty</button>
              <button className="button primary" name="status" value="credited">Hyvitetty</button>
              <button className="button" name="status" value="rejected">Hylätty</button>
            </div>
          </form>
        </article>
      </section>
    </AppShell>
  );
}

function buildDraft(
  invoice: string,
  reason: string,
  billed: number | string | null | undefined,
  expected: number | string | null | undefined,
  variance: number | string | null | undefined,
  currency: string,
) {
  return [
    "Hei,",
    "",
    "Pyydämme tarkistamaan rahtilaskun " + invoice + ".",
    "",
    reason,
    "",
    "Laskutettu: " + money(billed, currency),
    "Odotettu: " + money(expected, currency),
    "Erotus: " + money(variance, currency),
    "",
    "Pyydämme vahvistamaan poikkeaman ja tekemään tarvittavan hyvityksen.",
    "",
    "Ystävällisin terveisin",
  ].join("\n");
}

function money(value: number | string | null | undefined, currency: string) {
  if (value == null) return "—";
  return new Intl.NumberFormat("fi-FI", { style: "currency", currency }).format(Number(value));
}

function label(status: string) {
  const labels: Record<string, string> = {
    draft: "Luonnos",
    sent: "Lähetetty",
    accepted: "Hyväksytty",
    rejected: "Hylätty",
    credited: "Hyvitetty",
    closed: "Suljettu",
  };
  return labels[status] || status;
}
