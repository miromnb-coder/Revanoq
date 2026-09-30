import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";
import { createCarrier } from "./actions";

export default async function CarriersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const { supabase, workspace } = await getCurrentWorkspace();

  const { data: carriers } = await supabase
    .from("carriers")
    .select("id,name,carrier_code,vat_id,contact_email,active,created_at")
    .eq("workspace_id", workspace.id)
    .order("name");

  return (
    <AppShell workspaceName={workspace.name} active="/carriers">
      <header className="header">
        <div>
          <h1>Kuljetusyhtiöt</h1>
          <p className="kicker">
            Hallitse kuljetusyhtiöitä, tunnisteita ja niiden sopimuksia.
          </p>
        </div>
      </header>

      <section className="content-grid">
        <div className="panel">
          <h2>Lisää kuljetusyhtiö</h2>
          <p className="muted">
            Lisää vähintään nimi. Muut tunnisteet helpottavat laskujen kohdistamista.
          </p>

          <form className="stack-form" action={createCarrier}>
            {params.error && (
              <div className="notice error">
                Kuljetusyhtiön lisääminen epäonnistui. Tarkista tiedot.
              </div>
            )}
            {params.message === "created" && (
              <div className="notice">Kuljetusyhtiö lisättiin.</div>
            )}

            <label>
              Nimi
              <input name="name" placeholder="Esim. DB Schenker" required minLength={2} />
            </label>

            <div className="form-row">
              <label>
                Kuljetusyhtiön tunniste
                <input name="carrier_code" placeholder="Esim. DBSC" />
              </label>
              <label>
                Y-tunnus / VAT ID
                <input name="vat_id" placeholder="FI12345678" />
              </label>
            </div>

            <label>
              Yhteyssähköposti
              <input name="contact_email" type="email" placeholder="billing@carrier.com" />
            </label>

            <button className="button primary" type="submit">
              Lisää kuljetusyhtiö
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <h2>Nykyiset kuljetusyhtiöt</h2>
              <p className="muted">{carriers?.length ?? 0} kuljetusyhtiötä</p>
            </div>
          </div>

          <div className="list">
            {(carriers ?? []).map((carrier) => (
              <Link className="list-item" href={`/carriers/${carrier.id}`} key={carrier.id}>
                <div>
                  <strong>{carrier.name}</strong>
                  <span>
                    {[carrier.carrier_code, carrier.vat_id, carrier.contact_email]
                      .filter(Boolean)
                      .join(" · ") || "Ei lisätunnisteita"}
                  </span>
                </div>
                <span className={carrier.active ? "status success" : "status muted-status"}>
                  {carrier.active ? "Aktiivinen" : "Pois käytöstä"}
                </span>
              </Link>
            ))}

            {!carriers?.length && (
              <div className="empty-state">
                Ei kuljetusyhtiöitä vielä. Lisää ensimmäinen vasemmalta.
              </div>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
