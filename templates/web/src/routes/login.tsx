import { Button, Card, Input } from "@pands/ui";
import type React from "react";
import { useState } from "react";
import { authClient } from "./__root.js";

export default function LoginPage({ onNavigate }: { onNavigate?: (to: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.signIn.email({ email, password });
      if (res?.error) {
        setError(res.error.message ?? "Sign in failed");
      } else {
        onNavigate?.("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-12">
      <Card>
        <h2 className="mb-4 text-xl font-bold text-slate-900">Sign In</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            id="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
