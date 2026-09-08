import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fact Knowledge Layer",
  description: "Enterprise PDF fact extraction and relationship pipeline",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark antialiased`}>
      <body className="flex min-h-full flex-col lg:flex-row bg-background text-foreground" suppressHydrationWarning>
        <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card">
          <div className="flex h-14 items-center px-4 border-b border-border font-mono text-sm font-semibold tracking-tight">
            FACT_KNOWLEDGE_LAYER
          </div>
          <nav className="p-4 space-y-1">
            <NavLink href="/">Upload Document</NavLink>
            <NavLink href="/facts">Fact Browser</NavLink>
            <NavLink href="/demo-cases">Demo Cases</NavLink>
          </nav>
        </aside>
        <main className="flex-1 flex flex-col min-w-0">
          {children}
        </main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors border border-transparent hover:border-border"
    >
      {children}
    </Link>
  );
}
