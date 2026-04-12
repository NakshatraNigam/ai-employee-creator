"use client";

import { FormEvent, useState } from "react";

interface AuthPanelProps {
  isConfigured: boolean;
  isLoading: boolean;
  userEmail: string | null;
  onSendMagicLink: (email: string) => Promise<string>;
  onSignOut: () => Promise<void>;
}

export function AuthPanel({
  isConfigured,
  isLoading,
  userEmail,
  onSendMagicLink,
  onSignOut,
}: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) {
      setMessage("Please enter an email.");
      return;
    }

    setSending(true);
    const response = await onSendMagicLink(email);
    setMessage(response);
    setSending(false);
  };

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-heading text-lg font-semibold text-zinc-900">Supabase Auth</h3>

      {!isConfigured && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to use auth and
          persistence.
        </p>
      )}

      {isConfigured && isLoading && <p className="mt-2 text-sm text-zinc-500">Checking session...</p>}

      {isConfigured && !isLoading && userEmail && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-zinc-700">
            Signed in as <span className="font-semibold">{userEmail}</span>
          </p>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400"
          >
            Sign out
          </button>
        </div>
      )}

      {isConfigured && !isLoading && !userEmail && (
        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-800 focus:ring-2"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {sending ? "Sending..." : "Send magic link"}
          </button>
          {message && <p className="text-xs text-zinc-500">{message}</p>}
        </form>
      )}
    </section>
  );
}
