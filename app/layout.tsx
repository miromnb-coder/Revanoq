import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revanoq",
  description: "Rahtikulujen auditointi ja kustannuspoikkeamien tunnistus.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fi">
      <body>{children}</body>
    </html>
  );
}
