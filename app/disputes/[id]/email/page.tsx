import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";

export default async function DisputeEmailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await getCurrentWorkspace();

  const { data: dispute } = await supabase
    .from("disputes")
    .select("id,carrier_id,recipient_email,subject,body")
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .maybeSingle();

  if (!dispute) notFound();

  const { data: carrier } = await supabase
    .from("carriers")
    .select("name,contact_email")
    .eq("workspace_id", workspace.id)
    .eq("id", dispute.carrier_id)
    .maybeSingle();

  const recipient = dispute.recipient_email || carrier?.contact_email || "";
  const subject = dispute.subject || "Rahtilaskun reklamaatio";
  const body = dispute.body || "Pyydämme tarkistamaan rahtilaskun poikkeaman.";

  const emailHref =
    "mailto:" + encodeURIComponent(recipient) +
    "?subject=" + encodeURIComponent(subject) +
    "&body=" + encodeURIComponent(body);

  return (
    <AppShell workspaceName={workspace.name} active="/disputes">
      <div className="breadcrumbs">
        <Link href={"/disputes/" + id}>Reklamaatio</Link>
        <span>/</span>
        <span>Sähköpostiluonnos</span>
      </div>

      <header className="header">
        <div>
          <h1>Sähköpostiluonnos</h1>
          <p className="kicker">Valmis viesti kuljetusyhtiölle.</p>
        </div>
      </header>

      <article className="panel email-preview">
        <div className="email-field">
          <span>Vastaanottaja</span>
          <strong>{recipient || "Ei vastaanottajaa määritetty"}</strong>
        </div>
        <div className="email-field">
          <span>Otsikko</span>
          <strong>{subject}</strong>
        </div>
        <div className="email-body">{body}</div>

        <div className="header-actions">
          <Link className="button" href={"/disputes/" + id}>Takaisin</Link>
          <a className="button primary" href={emailHref}>Avaa sähköpostissa</a>
        </div>
      </article>
    </AppShell>
  );
}
