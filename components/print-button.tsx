"use client";

export function PrintButton() {
  return (
    <button className="button primary" type="button" onClick={() => window.print()}>
      Tulosta / tallenna PDF
    </button>
  );
}
