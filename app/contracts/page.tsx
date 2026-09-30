import { AppShell } from "@/components/app-shell";
import { getCurrentWorkspace } from "@/lib/current-workspace";
import { createContract } from "./actions";

const ruleNames: Record<string, string> = {
  base_rate: "Perushinta",
  fuel_surcharge: "Polttoainelisä",
  accessorial: "Lisämaksu",
  minimum_charge: "Minimiveloitus",
  discount: "Alennus",
  other: "Muu",
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; carrier?: string }>;
}) {
  const params = await searchParams;
  const { supabase, workspace } = await getCurrentWorkspace();

  const [{ data: carriers }, { data: contracts }, { data: rules }] = await Promise.all([
    supabase
      .from("carriers")
      .select("id,name")
      .eq("workspace_id", workspace.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("contracts")
      .select("id,name,carrier_id,currency,valid_from,valid_to,status,created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("rate_rules")
      .select("id,contract_id,rule_type,charge_code,unit,base_amount,percentage")
      .eq("workspace_id", workspace.id)
      .order("created_at"),
  ]);

  const carrierNames = new Map((carriers ?? []).map((carrier) => [carrier.id, carrier.name]));

  return (
    <AppShell workspaceName={workspace.name} active="/contracts">
      <header className="header">
        <div>
          <h1>Sopimukset ja hinnastot</h1>
          <p className="kicker">
            Määritä hinnat, polttoainelisät ja yleisimmät lisämaksut auditointia varten.
          </p>
        </div>
      </header>

      <section className="content-grid">
        <article className="panel">
          <h2>Luo sopimus</h2>
          <p className="muted">
            Ensimmäisessä versiossa hinnasto perustuu veloituskoodeihin. CSV-laskun
            charge_code kohdistetaan vastaavaan sääntöön.
          </p>

          <form className="stack-form" action={createContract}>
            {params.error && (
              <div className="notice error">
                Sopimuksen tallentaminen epäonnistui. Tarkista tiedot.
              </div>
            )}
            {params.message === "created" && (
              <div className="notice">Sopimus ja hinnastosäännöt tallennettiin.</div>
            )}

            <label>
              Kuljetusyhtiö
              <select name="carrier_id" defaultValue={params.carrier || ""} required>
                <option value="" disabled>Valitse kuljetusyhtiö</option>
                {(carriers ?? []).map((carrier) => (
                  <option value={carrier.id} key={carrier.id}>{carrier.name}</option>
                ))}
              </select>
            </label>

            <label>
              Sopimuksen nimi
              <input name="name" placeholder="Suomen kotimaan kuljetukset 2026" required />
            </label>

            <div className="form-row three">
              <label>
                Valuutta
                <input name="currency" defaultValue="EUR" maxLength={3} required />
              </label>
              <label>
                Voimassa alkaen
                <input name="valid_from" type="date" />
              </label>
              <label>
                Voimassa asti
                <input name="valid_to" type="date" />
              </label>
            </div>

            <div className="form-section">
              <h3>Perushinta</h3>
              <div className="form-row three">
                <label>
                  Veloituskoodi
                  <input name="base_code" defaultValue="BASE" />
                </label>
                <label>
                  Hinta
                  <input name="base_amount" inputMode="decimal" placeholder="125,00" />
                </label>
                <label>
                  Yksikkö
                  <select name="base_unit" defaultValue="shipment">
                    <option value="shipment">lähetys</option>
                    <option value="kg">kg</option>
                    <option value="pallet">lava</option>
                    <option value="line">laskurivi</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="form-section">
              <h3>Polttoainelisä</h3>
              <div className="form-row">
                <label>
                  Veloituskoodi
                  <input name="fuel_code" defaultValue="FUEL" />
                </label>
                <label>
                  Prosentti perushinnasta
                  <input name="fuel_percentage" inputMode="decimal" placeholder="14,5" />
                </label>
              </div>
            </div>

            <div className="form-section">
              <h3>Lisämaksut</h3>
              {[1, 2, 3].map((index) => (
                <div className="form-row" key={index}>
                  <label>
                    Lisämaksun koodi {index}
                    <input name={`accessorial_code_${index}`} placeholder={index === 1 ? "LIFTGATE" : "Esim. WAITING"} />
                  </label>
                  <label>
                    Kiinteä hinta
                    <input name={`accessorial_amount_${index}`} inputMode="decimal" placeholder="35,00" />
                  </label>
                </div>
              ))}
            </div>

            <button className="button primary" type="submit" disabled={!carriers?.length}>
              Tallenna sopimus
            </button>

            {!carriers?.length && (
              <p className="help-text">Lisää ensin vähintään yksi kuljetusyhtiö.</p>
            )}
          </form>
        </article>

        <article className="panel">
          <h2>Nykyiset sopimukset</h2>
          <p className="muted">{contracts?.length ?? 0} sopimusta</p>

          <div className="contract-list">
            {(contracts ?? []).map((contract) => {
              const contractRules = (rules ?? []).filter((rule) => rule.contract_id === contract.id);
              return (
                <div className="contract-card" id={contract.id} key={contract.id}>
                  <div className="section-heading">
                    <div>
                      <strong>{contract.name}</strong>
                      <span className="block-muted">
                        {carrierNames.get(contract.carrier_id) || "Tuntematon kuljetusyhtiö"} · {contract.currency}
                      </span>
                    </div>
                    <span className="status success">{contract.status}</span>
                  </div>

                  <div className="contract-period">
                    {contract.valid_from || "Ei alkupäivää"} – {contract.valid_to || "jatkuva"}
                  </div>

                  <div className="rule-list">
                    {contractRules.map((rule) => (
                      <div className="rule-row" key={rule.id}>
                        <div>
                          <strong>{ruleNames[rule.rule_type] || rule.rule_type}</strong>
                          <span>{rule.charge_code || "ei koodia"}</span>
                        </div>
                        <strong>
                          {rule.percentage != null
                            ? `${Number(rule.percentage).toLocaleString("fi-FI")} %`
                            : rule.base_amount != null
                              ? new Intl.NumberFormat("fi-FI", {
                                  style: "currency",
                                  currency: contract.currency,
                                }).format(Number(rule.base_amount))
                              : "—"}
                        </strong>
                      </div>
                    ))}
                    {!contractRules.length && <span className="muted">Ei hinnastosääntöjä.</span>}
                  </div>
                </div>
              );
            })}

            {!contracts?.length && (
              <div className="empty-state">Ei sopimuksia vielä.</div>
            )}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
