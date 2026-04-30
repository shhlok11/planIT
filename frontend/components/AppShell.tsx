"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { UserRead } from "@/lib/types";

interface AppShellProps {
  children: ReactNode;
  title: ReactNode;
  subtitle: string;
  uploadLabel?: string | null;
  user: UserRead | null;
  actions?: ReactNode;
  missionMeta?: ReactNode;
  sidebarStatus?: ReactNode;
  onLogout?: () => void | Promise<void>;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◫" },
  { href: "/courses", label: "Courses", icon: "◌" },
  { href: "/calendar", label: "Calendar", icon: "◧" },
  { href: "/conflicts", label: "Conflicts", icon: "⚠" },
];

export function AppShell({
  children,
  title,
  subtitle,
  uploadLabel,
  user,
  actions,
  missionMeta,
  sidebarStatus,
  onLogout,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="page-shell">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="glass-card" style={{ padding: "1.25rem" }}>
            <div className="eyebrow">planIT</div>
            <div className="display" style={{ fontSize: "2rem", marginTop: "0.35rem" }}>
              Mission Control
            </div>
            <p className="mono muted" style={{ marginTop: "0.9rem", lineHeight: 1.7 }}>
              {uploadLabel ?? "No mission loaded"}
            </p>
            <div className="mono" style={{ marginTop: "1rem", color: "var(--cyan)" }}>
              {user?.name || user?.email || "Anonymous Orbit"}
            </div>
            <div className="sidebar-user-actions">
              <Link href="/account" className="sidebar-user-link">
                Account
              </Link>
              {onLogout ? (
                <button className="sidebar-logout" onClick={() => void onLogout()}>
                  Logout
                </button>
              ) : null}
            </div>
          </div>

          {sidebarStatus ? (
            <div className="glass-card" style={{ padding: "1rem", marginTop: "1rem" }}>
              {sidebarStatus}
            </div>
          ) : null}

          <nav>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${isActive ? "active" : ""}`}>
                  <span className="mono" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="content-area">
          <header className="topbar">
            <div>
              <div className="display" role="heading" aria-level={1} style={{ fontSize: "clamp(2.9rem, 6vw, 5rem)", margin: 0 }}>
                {title}
              </div>
              <div className="eyebrow" style={{ marginTop: "0.75rem" }}>
                {subtitle}
              </div>
              {missionMeta ? <div style={{ marginTop: "0.85rem" }}>{missionMeta}</div> : null}
            </div>
            <div className="topbar-actions">{actions}</div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
