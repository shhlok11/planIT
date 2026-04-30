"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { SpotlightCard } from "@/components/SpotlightCard";
import { useAuth } from "@/hooks/useAuth";

export default function AccountPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.token) {
      router.replace("/");
    }
  }, [auth.loading, auth.token, router]);

  if (!auth.token) {
    return null;
  }

  return (
    <AppShell
      title="Account"
      subtitle="identity // session control // sign out"
      uploadLabel={auth.user ? auth.user.email : null}
      user={auth.user}
      onLogout={auth.logout}
      actions={(
        <div className="topbar-action-strip">
          <button className="cta-secondary mono" onClick={() => router.push("/dashboard")}>
            Dashboard
          </button>
        </div>
      )}
    >
      <div className="dashboard-grid">
        <SpotlightCard accent="cyan" className="section-panel">
          <div className="section-header">
            <div>
              <div className="eyebrow">Profile</div>
              <h2 className="display" style={{ margin: "0.35rem 0 0" }}>
                {auth.user?.name || "Anonymous Orbit"}
              </h2>
            </div>
          </div>
          <div className="account-grid">
            <div className="account-item">
              <div className="mono muted">Email</div>
              <div>{auth.user?.email ?? "Unknown"}</div>
            </div>
            <div className="account-item">
              <div className="mono muted">User ID</div>
              <div>{auth.user?.id ?? "—"}</div>
            </div>
            <div className="account-item">
              <div className="mono muted">Status</div>
              <div>{auth.user?.is_active ? "Active" : "Inactive"}</div>
            </div>
            <div className="account-item">
              <div className="mono muted">Session</div>
              <div>{auth.token ? "Authenticated" : "Signed out"}</div>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard accent="rose" className="section-panel">
          <div className="section-header">
            <div>
              <div className="eyebrow">Actions</div>
              <h2 className="display" style={{ margin: "0.35rem 0 0" }}>
                Session Controls
              </h2>
            </div>
          </div>
          <div className="stack">
            <button className="cta-primary mono" onClick={() => void auth.logout()}>
              Logout
            </button>
            <button className="cta-secondary mono" onClick={() => router.push("/dashboard")}>
              Return to Dashboard
            </button>
          </div>
        </SpotlightCard>
      </div>
    </AppShell>
  );
}
