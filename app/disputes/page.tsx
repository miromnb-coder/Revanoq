import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";

export default async function DisputesPage() {
  const { supabase, workspace } = await getCurrentWorkspace();

  const { data: disputes } = await supabase
    .from("disputes")
    .select("id,carrier_id,status,disputed_amount,credited_amount,subject,created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  const carrierIds = [...new Set((disputes ?? []).map((item) => item.carrier_id))];
  const { data: carriers } = carrierIds.length
    ? await supabase.from("carriers").select("id,name").eq("workspace_id", workspace.id).in("id", carrierIds)
    : { data: [] };

  const carrierMap = new Map((carriers ?? []).map((carrier) => [carrier.id, carrier.name]));
  const recovered = (disputes ?? [])
    .filter((item) => item.status === "credited")
    .reduce((sum, item) => sum + Number(item.credited_amount ?? 0), 0);

  return (
    <AppShell workspaceName={workspace.name} active="/disputes">
      <header className="header">
        <div>
          <h1>Reklamaatiot</h1>
          <p className="kicker">Seuraa auditointilöydöksistä syntyneitä reklamaatioita ja hyvityksiä.</p>
        </div>
      </header>

      <section className="grid compact-grid">
        <article className="card">
          <div className="metric-label">Reklamaatiot</div>
          <div className="stat">{disputes?.length ?? 0}</div>
          <p>Kaikki reklamaatiot ja luonnokset.</p>
        </article>
        <article className="card">
          <div className="metric-label">Hyvitetty yhteensä</div>
          <div className="stat metric-success">{money(recovered)}</div>
          <p>Todellinen takaisin saatu arvo.</p>
        </article>
      </section>

      <article className="panel findings-panel">
        <h2>Kaikki reklamaatiot</h2>
        <div className="list">
          {(disputes ?? []).map((item) => (
            <Link className="list-item" href={"/disputes/" + item.id} key={item.id}>
              <div>
                <strong>{item.subject || "Rahtilaskun reklamaatio"}</strong>
                <span>{carrierMap.get(item.carrier_id) || "Kuljetusyhtiö"} · {money(item.disputed_amount)}</span>
              </div>
              <span className={"status " + (item.status === "credited" ? "success" : "")}>{statusLabel(item.status)}</span>
            </Link>
          ))}
          {!disputes?.length && <div className="empty-state">Ei reklamaatioita vielä.</div>}
        </div>
      </article>
    </AppShell>
  );
}

function money(value: number | string | null) {
  return new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
}

function statusLabel(status: string) {
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
