import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { createWorkspace } from "./actions";
import { AppShell } from "@/components/app-shell";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/login");
  }

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

            {params.error && (
              <div className="notice error">
                Työtilan luominen epäonnistui. Kokeile toista nimeä.
              </div>
            )}

            <label>
              Yrityksen tai työtilan nimi
              <input
                name="name"
                type="text"
                minLength={2}
                maxLength={120}
                placeholder="Esimerkki Teollisuus Oy"
                required
              />
            </label>

            <button className="button primary" type="submit">
              Luo työtila
            </button>
          </form>
        </div>
      </main>
    );
  }

  const [
    carriersResult,
    invoicesResult,
    findingsResult,
    recoveredResult,
  ] = await Promise.all([
    supabase
      .from("carriers")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace.id),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace.id),
    supabase
      .from("audit_findings")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "open"),
    supabase
      .from("disputes")
      .select("credited_amount")
      .eq("workspace_id", workspace.id)
      .eq("status", "credited"),
  ]);

  const recovered = (recoveredResult.data ?? []).reduce(
    (sum, dispute) => sum + Number(dispute.credited_amount ?? 0),
    0,
  );

  const recoveredFormatted = new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(recovered);

  return (
    <AppShell workspaceName={workspace.name} active="/dashboard">
      <header className="header">
        <div>
          <h1>Auditoinnin yleiskuva</h1>
          <p className="kicker">
            Seuraa rahtilaskuja, poikkeamia ja takaisin saatua arvoa.
          </p>
        </div>
      </header>

      <section className="grid">
        <article className="card">
          <div className="metric-label">Kuljetusyhtiöt</div>
          <div className="stat">{carriersResult.count ?? 0}</div>
          <p>Työtilaan liitetyt kuljetusyhtiöt.</p>
        </article>

        <article className="card">
          <div className="metric-label">Laskut</div>
          <div className="stat">{invoicesResult.count ?? 0}</div>
          <p>Revanoqiin tallennetut rahtilaskut.</p>
        </article>

        <article className="card">
          <div className="metric-label">Avoimet löydökset</div>
          <div className="stat metric-danger">{findingsResult.count ?? 0}</div>
          <p>Poikkeamat, jotka odottavat tarkistusta.</p>
        </article>

        <article className="card">
          <div className="metric-label">Takaisin saatu</div>
          <div className="stat metric-success">{recoveredFormatted}</div>
          <p>Hyvitetty arvo ratkaistuista reklamaatioista.</p>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h2>Säästökehitys</h2>
          <p className="muted">Mahdolliset ja toteutuneet rahtisäästöt ajan myötä.</p>
          <div className="placeholder-chart" aria-hidden="true" />
        </article>

        <article className="panel">
          <h2>Auditointiprosessi</h2>
          <p className="muted">Ensimmäinen Revanoqin automatisoima työnkulku.</p>
          <div className="finding-list">
            <div className="finding-row"><strong>1. Kuljetusyhtiö</strong><span>profiili ja sopimus</span></div>
            <div className="finding-row"><strong>2. Lasku</strong><span>PDF / CSV -tuonti</span></div>
            <div className="finding-row"><strong>3. Auditointi</strong><span>hinnat ja poikkeamat</span></div>
            <div className="finding-row"><strong>4. Löydös</strong><span>hyväksy tai hylkää</span></div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
