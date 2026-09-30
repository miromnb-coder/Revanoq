import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/login");
  }

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id,name,slug")
    .order("created_at", { ascending: true });

  return (
    <main className="shell">
      <header className="header">
        <div>
          <div className="eyebrow">Revanoq</div>
          <h1>Audit workspace</h1>
          <p className="muted">
            {workspaces?.length
              ? `${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"} connected.`
              : "No workspace yet. The database foundation is ready for onboarding."}
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
          <div className="stat">—</div>
        </article>

        <article className="card">
          <div className="eyebrow">02</div>
          <h3>Invoices</h3>
          <p>Freight invoices waiting for extraction and audit.</p>
          <div className="stat">—</div>
        </article>

        <article className="card">
          <div className="eyebrow">03</div>
          <h3>Findings</h3>
          <p>Rate, fuel, accessorial, duplicate and shipment mismatches.</p>
          <div className="stat">—</div>
        </article>

        <article className="card">
          <div className="eyebrow">04</div>
          <h3>Recovered</h3>
          <p>Validated savings from resolved disputes.</p>
          <div className="stat">€0</div>
        </article>
      </section>
    </main>
  );
}
