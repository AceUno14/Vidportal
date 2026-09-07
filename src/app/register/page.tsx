"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, agencyName, email, password }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.error ?? "Could not create your account.");
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

  const inputStyle = {
    width: "100%",
    padding: "0.65rem 0.75rem",
    marginTop: "0.3rem",
    border: "1px solid #d6d3d1",
    borderRadius: "8px",
    fontSize: "1rem",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "1rem",
    color: "#292524",
    fontSize: "0.875rem",
    fontWeight: 600,
  };

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit} aria-busy={loading}>
        <div style={{ marginBottom: "1.5rem" }}>
          <p
            style={{
              marginBottom: "0.45rem",
              color: "#c84f40",
              fontSize: "0.75rem",
              fontWeight: 800,
              letterSpacing: "0.12em",
            }}
          >
            VIDPORTAL
          </p>
          <h1 style={{ fontSize: "1.6rem", marginBottom: "0.45rem" }}>
            Create your workspace
          </h1>
          <p style={{ color: "#57534e", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Set up your agency account. You can add clients after signing in.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem",
              borderRadius: "8px",
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}

        <label style={labelStyle}>
          Your name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
            maxLength={100}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Agency or workspace name
          <input
            type="text"
            value={agencyName}
            onChange={(event) => setAgencyName(event.target.value)}
            autoComplete="organization"
            required
            maxLength={100}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            aria-describedby="password-help"
            required
            minLength={8}
            maxLength={128}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            aria-describedby="password-help"
            required
            minLength={8}
            maxLength={128}
            style={inputStyle}
          />
        </label>

        <p className="field-help" id="password-help">Use 8–128 characters for your password.</p>

        <button
          className="primary-button auth-submit"
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.7rem",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Creating workspace..." : "Create account"}
        </button>

        <p
          style={{
            marginTop: "1.25rem",
            textAlign: "center",
            color: "#57534e",
            fontSize: "0.875rem",
          }}
        >
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#c84f40", fontWeight: 600 }}>
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
