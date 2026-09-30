import Link from "next/link";
import { logout } from "@/app/login/actions";

const items = [
  ["Yleiskuva", "/dashboard"],
  ["Laskut", "/invoices"],
  ["Löydökset", "/findings"],
  ["Sopimukset", "/contracts"],
  ["Kuljetusyhtiöt", "/carriers"],
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
        <Link href="/dashboard" className="brand">REVANOQ</Link>
        <div className="sidebar-product">Freight cost intelligence</div>

        <nav className="sidebar-nav" aria-label="Päänavigaatio">
          {items.map(([label, href]) => (
            <Link
              className={`sidebar-item${active === href ? " active" : ""}`}
              href={href}
              key={href}
            >
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          Työtila
          <strong>{workspaceName}</strong>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="search">Freight audit workspace</div>
          <form action={logout}>
            <button className="button" type="submit">Kirjaudu ulos</button>
          </form>
        </div>

        {children}
      </main>
    </div>
  );
}
