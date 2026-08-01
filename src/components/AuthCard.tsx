"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, role }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong");
    router.push("/dashboard");
    router.refresh();
  }

  const input =
    "w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal text-ink placeholder:text-soft";

  return (
    <div className="fade-up rounded-2xl bg-surface border border-line p-8 max-w-md w-full mx-auto shadow-sm">
      <div className="flex rounded-lg bg-paper border border-line p-1 mb-6">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
              mode === m ? "bg-surface shadow-sm text-teal" : "text-soft"
            }`}
          >
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && (
          <>
            <div className="flex gap-2">
              {(["STUDENT", "TEACHER"] as const).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    role === r
                      ? "border-teal bg-tealwash text-tealdeep"
                      : "border-line text-soft"
                  }`}
                >
                  {r === "STUDENT" ? "Student" : "Teacher"}
                </button>
              ))}
            </div>
            <input className={input} placeholder="Full name" value={form.name} required
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </>
        )}
        <input className={input} type="email" placeholder="Email address" value={form.email} required
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className={input} type="password" placeholder="Password" value={form.password} required
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-teal hover:bg-tealdeep disabled:opacity-50 text-paper font-semibold py-3 transition-colors"
        >
          {busy ? "Please wait" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-xs text-soft text-center">
        Secure sessions. Role-based access. Passwords hashed with bcrypt.
      </p>
    </div>
  );
}
