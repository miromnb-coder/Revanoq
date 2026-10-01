import Link from "next/link";
import { logout } from "@/app/login/actions";

type IconName = "home" | "invoice" | "findings" | "disputes" | "contracts" | "carriers";

const items: Array<[IconName, string, string]> = [
  ["home", "Yleiskuva", "/dashboard"],
  ["invoice", "Laskut", "/freight-invoices"],
  ["findings", "Löydökset", "/findings"],
  ["disputes", "Reklamaatiot", "/disputes"],
  ["contracts", "Sopimukset", "/contracts"],
  ["carriers", "Kuljetusyhtiöt", "/carriers"],
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
              <span className="sidebar-icon" aria-hidden="true">
                <NavIcon name={icon} />
              </span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-account">
          <span className="sidebar-avatar">{workspaceName.slice(0, 2).toUpperCase()}</span>
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

function NavIcon({ name }: { name: IconName }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    );
  }

  if (name === "invoice") {
    return (
      <svg {...common}>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M15 3v4h4" />
        <path d="M9 11h6M9 15h6M9 19h4" />
      </svg>
    );
  }

  if (name === "findings") {
    return (
      <svg {...common}>
        <path d="M12 3 3.5 20h17z" />
        <path d="M12 9v4.5" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  if (name === "disputes") {
    return (
      <svg {...common}>
        <path d="M4 5.5h16v10H8l-4 3z" />
        <path d="M8 9h8M8 12h5" />
      </svg>
    );
  }

  if (name === "contracts") {
    return (
      <svg {...common}>
        <path d="M7 3h10v18H7z" />
        <path d="M10 8h4M10 12h4M10 16h3" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="16.5" cy="9.5" r="2.5" />
      <path d="M3.5 20c.6-4 2.5-6 5.5-6s4.9 2 5.5 6" />
      <path d="M14 15c3.2.1 5.2 1.8 6 5" />
    </svg>
  );
}
