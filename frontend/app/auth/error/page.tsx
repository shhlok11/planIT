"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AuthErrorPage() {
  const [message, setMessage] = useState("Authentication failed.");

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    setMessage(params.get("error") || "Authentication failed.");
  }, []);

  return (
    <div className="processing-screen">
      <div className="panel processing-card">
        <div className="display" style={{ fontSize: "2.5rem", color: "#fca5a5" }}>Access Denied</div>
        <div className="error-banner" style={{ marginTop: "1rem" }}>{message}</div>
        <Link href="/" className="cta-primary mono" style={{ display: "inline-block", marginTop: "1rem" }}>
          Return Home
        </Link>
      </div>
    </div>
  );
}
