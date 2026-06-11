import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { AuthShell } from "../../components/auth/AuthShell";

const ROLES = ["patient", "doctor"];

const ROLE_DESCRIPTIONS = {
  patient: "Monitor skin health, upload photos, and receive AI-powered screenings.",
  doctor: "Review patient scans, access clinical tools, and manage diagnoses.",
};

export function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [role, setRole] = useState("patient");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setIsSubmitting(true);
    try {
      await register({ ...form, role });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Join SkinGuru — AI-powered skin health screening."
      subtitle="Register as a patient or doctor to access personalised dashboards, photo-based AI screenings, and role-gated healthcare tools."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-2xl font-semibold">Create Account</h2>
          <p className="mt-1 text-sm text-sage">Fill in your details to get started.</p>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-xl bg-blush/10 px-4 py-3 text-sm text-blush">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        ) : null}

        {/* Role picker */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink/78">I am registering as</p>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                id={`register-role-${r}`}
                onClick={() => setRole(r)}
                className={`relative rounded-xl border-2 px-4 py-3 text-left text-sm transition ${
                  role === r
                    ? "border-forest bg-forest/5 text-forest"
                    : "border-line bg-white text-sage hover:border-sage"
                }`}
              >
                <span className="block font-semibold capitalize">{r}</span>
                <span className="mt-0.5 block text-xs leading-snug opacity-75">{ROLE_DESCRIPTIONS[r]}</span>
                {role === r && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-forest text-white text-[10px]">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm font-medium text-ink/78">
          Full name
          <input
            id="register-fullname"
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
            type="text"
            autoComplete="name"
            placeholder="Jane Smith"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
            minLength={2}
          />
        </label>

        <label className="block text-sm font-medium text-ink/78">
          Email address
          <input
            id="register-email"
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>

        <label className="block text-sm font-medium text-ink/78">
          Password
          <input
            id="register-password"
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
            type="password"
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
          />
          {form.password.length > 0 && (
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    form.password.length >= level * 3
                      ? level <= 2
                        ? "bg-blush"
                        : level === 3
                        ? "bg-lime"
                        : "bg-forest"
                      : "bg-line"
                  }`}
                />
              ))}
            </div>
          )}
        </label>

        <button
          id="register-submit"
          className="w-full rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Creating account…
            </span>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-sage">
        Already have an account?{" "}
        <Link className="font-semibold text-forest hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
