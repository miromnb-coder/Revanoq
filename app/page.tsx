import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand">REVANOQ</div>
        <Link className="button" href="/login">Sign in</Link>
      </nav>

      <section className="hero">
        <div className="eyebrow">Freight cost intelligence</div>
        <h1>Find what your freight costs are hiding.</h1>
        <p>
          Revanoq compares carrier invoices against shipments, contracts and rate rules,
          then turns discrepancies into evidence-backed audit findings.
        </p>
        <div className="actions">
          <Link className="button primary" href="/login">Open workspace</Link>
        </div>
      </section>
    </main>
  );
}
