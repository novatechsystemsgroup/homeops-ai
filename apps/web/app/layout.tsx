import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeOps AI",
  description: "Household operations agent: from a spoken problem to an executable plan."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="antialiased">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/20 text-lg">🏠</span>
            <span className="text-lg font-semibold tracking-tight">HomeOps AI</span>
          </a>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <a className="hover:text-white" href="/alexa">
              Alexa+ simulator
            </a>
            <a className="hover:text-white" href="/nebius">
              Agent trace
            </a>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 pb-16">{children}</main>
      </body>
    </html>
  );
}
