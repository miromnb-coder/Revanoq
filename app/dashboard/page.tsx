import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { createWorkspace } from "./actions";

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
      <main className="shell">
        <header className="header">
          <div>
            <div className="eyebrow">Revanoq</div>
            <h1>Create your workspace</h1>
            <p className="muted">
              Start with one company workspace. Carriers, contracts, shipments,
              invoices and audit findings will be isolated inside it.
            </p>
          </div>

          <form action={logout}>
            <button className="button" type="submit">
              Sign out
            </button>
          </form>
        </header>

        <form className="form" action={createWorkspace}>
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
      .select("disputed_amount")
      .eq("workspace_id", workspace.id)
      .eq("status", "credited"),
  ]);

  const recovered = (recoveredResult.data ?? []).reduce(
    (sum, dispute) => sum + Number(dispute.disputed_amount ?? 0),
    0,
  );

  return (
    <main className="shell">
      <header className="header">
        <div>
          <div className="eyebrow">Revanoq · {workspace.name}</div>
          <h1>Audit workspace</h1>
          <p className="muted">
            Freight invoice control from contract rates to evidence-backed disputes.
          </p>
        </div>

        <form action={logout}>
          <button className="button" type="submit">
            Sign out
          </button>
        </form>
      </header>

      <section className="grid">
        <article className="card">
          <div className="eyebrow">01</div>
          <h3>Carriers</h3>
          <p>Carrier profiles and the contracts linked to them.</p>
          <div className="stat">{carriersResult.count ?? 0}</div>
        </article>

        <article className="card">
          <div className="eyebrow">02</div>
          <h3>Invoices</h3>
          <p>Freight invoices uploaded into the workspace.</p>
          <div className="stat">{invoicesResult.count ?? 0}</div>
        </article>

        <article className="card">
          <div className="eyebrow">03</div>
          <h3>Open findings</h3>
          <p>Audit discrepancies still waiting for review.</p>
          <div className="stat">{findingsResult.count ?? 0}</div>
        </article>

        <article className="card">
          <div className="eyebrow">04</div>
          <h3>Recovered</h3>
          <p>Credited value from resolved carrier disputes.</p>
          <div className="stat">
            {new Intl.NumberFormat("en-FI", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(recovered)}
          </div>
        </article>
      </section>
    </main>
  );
}
