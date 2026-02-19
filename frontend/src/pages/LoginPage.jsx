import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthProvider";

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, username, password });
      }
      navigate("/problems", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="oj-bg min-h-screen px-5 py-8 md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl grid-cols-1 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--card)] shadow-[0_30px_80px_rgba(21,24,34,0.12)] md:grid-cols-[1.15fr,0.85fr]">
        <section className="relative hidden overflow-hidden border-r border-[var(--line)] bg-gradient-to-br from-[#10151f] via-[#161d2a] to-[#0f131c] p-10 text-white md:block">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[var(--accent)]/20 blur-3xl" />
          <div className="absolute -left-16 bottom-10 h-52 w-52 rounded-full bg-sky-400/20 blur-3xl" />
          <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
            Online Judge
          </p>
          <h1 className="mt-6 max-w-md text-4xl font-extrabold leading-tight">
            Code. Submit. Track verdicts in real time.
          </h1>
          <p className="mt-5 max-w-md text-sm text-slate-200/90">
            LeetCode-style workflow with fast submissions, result timelines, and contest-ready
            backend architecture.
          </p>
          <div className="mt-10 grid gap-3 text-sm">
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
              Real-time socket updates for verdict changes
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
              JWT auth with refresh-token cookies
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
              Problem + testcase + submission lifecycle
            </div>
          </div>
        </section>

        <section className="card-pop flex items-center justify-center bg-[var(--card)] p-6 md:p-10">
          <div className="w-full max-w-md">
            <p className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-ink)]">
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)]">
              {mode === "login" ? "Sign In" : "Register"}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Use your account to continue to the judge workspace.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-[var(--ink)]">Email</label>
                <input
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none ring-[var(--accent)]/40 transition focus:ring-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </div>

              {mode === "register" && (
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-[var(--ink)]">Username</label>
                  <input
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none ring-[var(--accent)]/40 transition focus:ring-2"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="grid gap-2">
                <label className="text-sm font-semibold text-[var(--ink)]">Password</label>
                <input
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none ring-[var(--accent)]/40 transition focus:ring-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}
                </p>
              ) : null}

              <button
                className="w-full rounded-xl border border-amber-300/40 bg-[var(--accent)] px-4 py-2.5 text-sm font-extrabold text-[#1b1305] shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)] transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <button
              className="mt-5 rounded-lg px-1 text-sm font-bold text-[var(--accent-ink)] underline-offset-4 transition hover:underline"
              onClick={() => setMode((prev) => (prev === "login" ? "register" : "login"))}
            >
              {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
