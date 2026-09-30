import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await getCurrentWorkspace();

  const { data: dispute } = await supabase
    .from("disputes")
    .select("id,status,subject,disputed_amount,credited_amount")
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .maybeSingle();

  if (!dispute) notFound();

  return (
    <AppShell workspaceName={workspace.name} active="/disputes">
      <div className="breadcrumbs">
        <Link href="/disputes">Reklamaatiot</Link>
        <span>/</span>
        <span>{dispute.subject || "Reklamaatio"}</span>
      </div>
      <header className="header">
        <div>
          <h1>{dispute.subject || "Rahtilaskun reklamaatio"}</h1>
          <p className="kicker">{dispute.status}</p>
        </div>
      </header>
      <section className="grid compact-grid">
        <article className="card">
          <div className="metric-label">Reklamoitava</div>
          <div className="stat">{money(dispute.disputed_amount)}</div>
        </article>
        <article className="card">
          <div className="metric-label">Hyvitetty</div>
          <div className="stat metric-success">{money(dispute.credited_amount)}</div>
        </article>
      </section>
      <article className="panel findings-panel">
        <p className="muted">Reklamaation työkalut latautuvat tähän näkymään.</p>
      </article>
    </AppShell>
  );
}

function money(value: number | string | null) {
  return new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
}
