import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";
import { toggleCarrierActive } from "../actions";

export default async function CarrierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await getCurrentWorkspace();

  const { data: carrier } = await supabase
    .from("carriers")
    .select("id,name,carrier_code,vat_id,contact_email,active,created_at")
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .maybeSingle();

  if (!carrier) notFound();

  const [{ data: contracts }, { data: invoices }] = await Promise.all([
    supabase
      .from("contracts")
      .select("id,name,status,valid_from,valid_to,currency")
      .eq("workspace_id", workspace.id)
      .eq("carrier_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id,invoice_number,invoice_date,total_amount,currency,status")
      .eq("workspace_id", workspace.id)
      .eq("carrier_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <AppShell workspaceName={workspace.name} active="/carriers">
      <div className="breadcrumbs">
        <Link href="/carriers">Kuljetusyhtiöt</Link>
        <span>/</span>
        <span>{carrier.name}</span>
      </div>

      <header className="header">
        <div>
          <h1>{carrier.name}</h1>
          <p className="kicker">
            {[carrier.carrier_code, carrier.vat_id, carrier.contact_email]
              .filter(Boolean)
              .join(" · ") || "Ei lisätunnisteita"}
          </p>
        </div>

        <form action={toggleCarrierActive}>
          <input type="hidden" name="carrier_id" value={carrier.id} />
          <input type="hidden" name="active" value={String(carrier.active)} />
          <button className="button" type="submit">
            {carrier.active ? "Poista käytöstä" : "Aktivoi"}
          </button>
        </form>
      </header>

      <section className="grid">
        <article className="card">
          <div className="metric-label">Sopimukset</div>
          <div className="stat">{contracts?.length ?? 0}</div>
          <p>Kaikki kuljetusyhtiölle luodut sopimukset.</p>
        </article>
        <article className="card">
          <div className="metric-label">Laskut</div>
          <div className="stat">{invoices?.length ?? 0}</div>
          <p>Viimeisimmät Revanoqiin tuodut laskut.</p>
        </article>
        <article className="card">
          <div className="metric-label">Tila</div>
          <div className="stat small-stat">{carrier.active ? "Aktiivinen" : "Pois käytöstä"}</div>
          <p>Kuljetusyhtiön nykyinen tila.</p>
        </article>
        <article className="card">
          <div className="metric-label">Yhteys</div>
          <div className="stat small-stat">{carrier.contact_email || "—"}</div>
          <p>Laskutuksen tai yhteyshenkilön sähköposti.</p>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <h2>Sopimukset</h2>
              <p className="muted">Hinnastot ja voimassaoloajat.</p>
            </div>
            <Link className="button primary" href={`/contracts?carrier=${carrier.id}`}>
              Luo sopimus
            </Link>
          </div>

          <div className="list">
            {(contracts ?? []).map((contract) => (
              <Link href={`/contracts#${contract.id}`} className="list-item" key={contract.id}>
                <div>
                  <strong>{contract.name}</strong>
                  <span>
                    {contract.currency} · {contract.valid_from || "ei alkupäivää"} – {contract.valid_to || "jatkuva"}
                  </span>
                </div>
                <span className="status">{contract.status}</span>
              </Link>
            ))}
            {!contracts?.length && <div className="empty-state">Ei sopimuksia vielä.</div>}
          </div>
        </article>

        <article className="panel">
          <h2>Viimeisimmät laskut</h2>
          <p className="muted">Kuljetusyhtiön viimeisimmät rahtilaskut.</p>
          <div className="list">
            {(invoices ?? []).map((invoice) => (
              <Link href={`/invoices/${invoice.id}`} className="list-item" key={invoice.id}>
                <div>
                  <strong>{invoice.invoice_number}</strong>
                  <span>{invoice.invoice_date || "Ei päivää"}</span>
                </div>
                <strong>
                  {new Intl.NumberFormat("fi-FI", {
                    style: "currency",
                    currency: invoice.currency,
                  }).format(Number(invoice.total_amount))}
                </strong>
              </Link>
            ))}
            {!invoices?.length && <div className="empty-state">Ei laskuja vielä.</div>}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
