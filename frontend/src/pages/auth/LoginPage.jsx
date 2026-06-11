import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { AuthShell } from "../../components/auth/AuthShell";

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already logged in → redirect
  if (user) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(form);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="SkinGuru Portal"
      title="Welcome to SkinGuru."
      subtitle="Access personalized AI skin screening, manage your skin profile, and track your dermatological health securely."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-2xl font-semibold">Sign In</h2>
          <p className="mt-1 text-sm text-sage">Use your email &amp; password or a Google account.</p>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-xl bg-blush/10 px-4 py-3 text-sm text-blush">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        ) : null}

        <label className="block text-sm font-medium text-ink/78">
          Email address
          <input
            id="login-email"
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>

        <label className="block text-sm font-medium text-ink/78">
          Password
          <input
            id="login-password"
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </label>

        <button
          id="login-submit"
          className="w-full rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Signing in…
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-sage">
        New to SkinGuru?{" "}
        <Link className="font-semibold text-forest hover:underline" to="/register">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
