"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        rememberMe: true,
      });

      if (signInError) {
        setError(signInError.message ?? "Invalid email or password.");
        setLoading(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit} aria-busy={loading}>
        <p className="eyebrow">VIDPORTAL</p>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Log in to VidPortal</h1>

        {error && (
          <div
            role="alert"
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "0.75rem",
              borderRadius: "8px",
              marginBottom: "1rem",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        <label htmlFor="login-email" className="field-label">
          Email
        </label>
        <input
          id="login-email"
          autoComplete="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "1rem",
            border: "1px solid #d6d3d1",
            borderRadius: "8px",
          }}
        />

        <label htmlFor="login-password" className="field-label">
          Password
        </label>
        <input
          id="login-password"
          autoComplete="current-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "0.5rem",
            marginBottom: "1.5rem",
            border: "1px solid #d6d3d1",
            borderRadius: "8px",
          }}
        />

        <button
          className="primary-button auth-submit"
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.6rem",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
          }}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>

        <p
          style={{
            marginTop: "1.25rem",
            textAlign: "center",
            color: "#57534e",
            fontSize: "0.875rem",
          }}
        >
          New to VidPortal?{" "}
          <Link href="/register" style={{ color: "#c84f40", fontWeight: 600 }}>
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
