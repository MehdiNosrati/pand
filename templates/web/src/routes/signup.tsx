import "@methane-ui/ui/alert";
import "@methane-ui/ui/button";
import "@methane-ui/ui/card";
import "@methane-ui/ui/input";
import "@methane-ui/ui/password-input";
import type React from "react";
import { useState } from "react";
import { authClient } from "./__root.js";

export default function SignupPage({ onNavigate }: { onNavigate?: (to: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.signUp.email({ name, email, password });
      if (res?.error) {
        setError(res.error.message ?? "Sign up failed");
      } else {
        onNavigate?.("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pand-auth-wrap">
      <mth-card variant="outlined">
        <h2 className="pand-section-title">Create Account</h2>
        <form onSubmit={handleSubmit} className="mth-stack" data-gap="4">
          <mth-input
            label="Name"
            required
            value={name}
            onmth-input={(e) => setName(e.detail.value)}
          />
          <mth-input
            label="Email"
            type="email"
            required
            value={email}
            onmth-input={(e) => setEmail(e.detail.value)}
          />
          <mth-password-input
            label="Password"
            toggleable
            required
            value={password}
            onmth-input={(e) => setPassword(e.detail.value)}
          />
          {error ? (
            <mth-alert variant="danger" open>
              {error}
            </mth-alert>
          ) : null}
          <mth-button
            type="submit"
            variant="solid"
            loading={loading}
            disabled={loading}
            className="pand-full-width"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </mth-button>
        </form>
      </mth-card>
    </div>
  );
}
