import Link from "next/link";
import { logout } from "@/app/login/actions";

const items = [
  ["⌂", "Yleiskuva", "/dashboard"],
  ["▤", "Laskut", "/freight-invoices"],
  ["△", "Löydökset", "/findings"],
  ["◇", "Reklamaatiot", "/disputes"],
  ["≡", "Sopimukset", "/contracts"],
  ["◎", "Kuljetusyhtiöt", "/carriers"],
];

export function AppShell({
  workspaceName,
  active,
  children,
}: {
  workspaceName: string;
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand-wrap">
          <Link href="/dashboard" className="brand sidebar-brand">REVANOQ</Link>
          <span className="sidebar-mark" aria-hidden="true">R</span>
        </div>

        <div className="sidebar-section-label">Työtila</div>

        <nav className="sidebar-nav" aria-label="Päänavigaatio">
          {items.map(([icon, label, href]) => (
            <Link
              className={`sidebar-item${active === href ? " active" : ""}`}
              href={href}
              key={href}
            >
              <span className="sidebar-icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-account">
          <span className="sidebar-avatar">
            {workspaceName.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <span className="sidebar-account-label">Työtila</span>
            <strong>{workspaceName}</strong>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="topbar-context">
            <span className="topbar-dot" />
            Freight cost intelligence
          </div>
          <form action={logout}>
            <button className="button button-quiet" type="submit">Kirjaudu ulos</button>
          </form>
        </div>

        {children}
      </main>
    </div>
  );
}
