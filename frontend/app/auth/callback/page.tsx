"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { setStoredToken } from "@/lib/storage";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");

    if (token) {
      setStoredToken(token);
      window.history.replaceState(null, "", "/auth/callback");
      router.replace("/dashboard");
      return;
    }

    router.replace(`/auth/error#error=${encodeURIComponent("No access token received")}`);
  }, [router]);

  return (
    <div className="processing-screen">
      <div className="panel processing-card">
        <div className="display" style={{ fontSize: "2.3rem" }}>Establishing uplink...</div>
        <p className="muted">Storing the authenticated session and redirecting to mission control.</p>
      </div>
    </div>
  );
}
