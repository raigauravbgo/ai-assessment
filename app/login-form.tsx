"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ initialToken }: { initialToken: string }) {
  const [name, setName] = useState("");
  const [token, setToken] = useState(initialToken);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/participant/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, token }),
      });
      if (!res.ok) {
        setError(
          res.status === 401
            ? "Name or token didn't match. Check both and try again."
            : "Something went wrong. Try again in a moment.",
        );
        return;
      }
      router.push("/problems");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Your name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      <div>
        <label
          htmlFor="token"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Token
        </label>
        <input
          id="token"
          type="text"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting || !name || !token}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {submitting ? "Signing in..." : "Continue"}
      </button>
    </form>
  );
}
