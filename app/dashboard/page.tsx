import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { createWorkspace } from "./actions";

const navItems = [
  ["▦", "Overview"],
  ["▤", "Invoices"],
  ["!", "Findings"],
  ["≡", "Contracts"],
  ["C", "Carriers"],
  ["S", "Shipments"],
  ["D", "Disputes"],
  ["R", "Reports"],
];

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
              <button className="button" type="submit">Sign out</button>
            </form>
          </nav>

          <form className="form" action={createWorkspace}>
            <div>
              <div className="eyebrow">Workspace setup</div>
              <h1>Create your workspace</h1>
              <p className="muted">
                Start with one company workspace for carriers, contracts, shipments,
                invoices and audit findings.
              </p>
            </div>

            {params.error && (
              <div className="notice error">
                Workspace creation failed. Try a different company name.
              </div>
            )}

            <label>
              Company or workspace name
              <input
                name="name"
                type="text"
                minLength={2}
                maxLength={120}
                placeholder="Example Manufacturing Oy"
                required
              />
            </label>

            <button className="button primary" type="submit">
              Create workspace
            </button>
          </form>
        </div>
      </main>
    );
  }

  const [carriersResult, invoicesResult, findingsResult, recoveredResult] =
    await Promise.all([
      supabase.from("carriers").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id),
      supabase.from("invoices").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id),
      supabase.from("audit_findings").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "open"),
      supabase.from("disputes").select("disputed_amount").eq("workspace_id", workspace.id).eq("status", "credited"),
    ]);

  const recovered = (recoveredResult.data ?? []).reduce(
    (sum, dispute) => sum + Number(dispute.disputed_amount ?? 0),
    0,
  );

  const recoveredFormatted = new Intl.NumberFormat("en-FI", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(recovered);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">REVANOQ</div>

        <nav className="sidebar-nav">
          {navItems.map(([icon, label], index) => (
            <div className={`sidebar-item${index === 0 ? " active" : ""}`} key={label}>
              <span className="sidebar-icon">{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          Workspace
          <strong>{workspace.name}</strong>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="search">⌕ &nbsp; Search invoices, carriers, findings…</div>
          <form action={logout}>
            <button className="button" type="submit">Sign out</button>
          </form>
        </div>

        <header className="header">
          <div>
            <h1>Audit overview</h1>
            <p className="kicker">
              Monitor freight invoices, discrepancies and recovered value.
            </p>
          </div>
        </header>

        <section className="grid">
          <article className="card">
            <div className="metric-label">Carriers</div>
            <div className="stat">{carriersResult.count ?? 0}</div>
            <p>Carrier profiles connected to this workspace.</p>
          </article>

          <article className="card">
            <div className="metric-label">Invoices audited</div>
            <div className="stat">{invoicesResult.count ?? 0}</div>
            <p>Freight invoices currently stored in Revanoq.</p>
          </article>

          <article className="card">
            <div className="metric-label">Open findings</div>
            <div className="stat metric-danger">{findingsResult.count ?? 0}</div>
            <p>Discrepancies still waiting for review or dispute.</p>
          </article>

          <article className="card">
            <div className="metric-label">Recovered</div>
            <div className="stat metric-success">{recoveredFormatted}</div>
            <p>Credited value from resolved carrier disputes.</p>
          </article>
        </section>

        <section className="panel-grid">
          <article className="panel">
            <h2>Savings trend</h2>
            <p className="muted">Potential and recovered freight savings over time.</p>
            <div className="placeholder-chart" aria-hidden="true" />
          </article>

          <article className="panel">
            <h2>Audit workflow</h2>
            <p className="muted">The first operational path Revanoq will automate.</p>
            <div className="finding-list">
              <div className="finding-row"><strong>1. Carrier</strong><span>profile & contract</span></div>
              <div className="finding-row"><strong>2. Invoice</strong><span>upload & extraction</span></div>
              <div className="finding-row"><strong>3. Audit</strong><span>rates & discrepancies</span></div>
              <div className="finding-row"><strong>4. Dispute</strong><span>evidence & recovery</span></div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
