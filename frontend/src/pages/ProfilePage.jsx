import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { TopNav } from "../components/layout/TopNav";

const ROLE_BADGE = {
  patient: { label: "Patient", bg: "bg-lime/20 text-forest" },
  doctor: { label: "Doctor", bg: "bg-mint/40 text-forest" },
  admin: { label: "Administrator", bg: "bg-blush/20 text-blush" },
};

function StatChip({ label, value }) {
  return (
    <div className="rounded-xl bg-foam px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-sage">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

export function ProfilePage() {
  const { user, saveProfile } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    phone: user?.phone || "",
    bio: user?.bio || "",
    avatar_url: user?.avatar_url || "",
  });
  const [status, setStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  if (!user) return null;

  const badge = ROLE_BADGE[user.role] || { label: user.role, bg: "bg-sand text-sage" };
  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");
    try {
      await saveProfile({
        full_name: form.full_name || undefined,
        phone: form.phone || undefined,
        bio: form.bio || undefined,
        avatar_url: form.avatar_url || undefined,
      });
      setStatus("saved");
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-mist text-ink">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-6rem] top-[8rem] h-72 w-72 rounded-full bg-white/40 blur-3xl" />
        <div className="absolute bottom-[-6rem] right-[-4rem] h-96 w-96 rounded-full bg-lime/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-20 pt-4 sm:px-6 xl:px-8">
        <TopNav />

        <main className="mx-auto mt-6 max-w-3xl">
          <div className="mb-6 flex items-center gap-3">
            <Link to="/app" className="text-sm text-sage hover:text-ink transition">← Back to Scan</Link>
          </div>

          {/* Profile header card */}
          <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl sm:p-8">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              {/* Avatar */}
              <div className="relative">
                {form.avatar_url ? (
                  <img
                    src={form.avatar_url}
                    alt={user.full_name}
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-forest/10"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-forest text-2xl font-bold text-white ring-4 ring-forest/10">
                    {user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-semibold">{user.full_name}</h1>
                <p className="text-sm text-sage">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${badge.bg}`}>
                    {badge.label}
                  </span>
                  <span className="rounded-full bg-foam px-3 py-1 text-xs font-medium text-sage capitalize">
                    {user.provider === "google" ? "🔵 Google account" : "🔑 Email account"}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatChip label="Member since" value={joinedDate} />
              <StatChip label="Account type" value={badge.label} />
              <StatChip label="Auth provider" value={user.provider === "google" ? "Google OAuth" : "Email / Password"} />
            </div>
          </div>

          {/* Edit form */}
          <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl sm:p-8">
            <h2 className="text-lg font-semibold">Edit Profile</h2>
            <p className="mt-1 text-sm text-sage">Update your public information. Changes are saved securely.</p>

            <div className="mt-6 space-y-5">
              {/* Full name */}
              <label className="block text-sm font-medium text-ink/80">
                Full name
                <input
                  id="profile-fullname"
                  className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  minLength={2}
                  required
                />
              </label>

              {/* Phone */}
              <label className="block text-sm font-medium text-ink/80">
                Phone number <span className="text-sage font-normal">(optional)</span>
                <input
                  id="profile-phone"
                  className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>

              {/* Bio */}
              <label className="block text-sm font-medium text-ink/80">
                Bio <span className="text-sage font-normal">(optional)</span>
                <textarea
                  id="profile-bio"
                  className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15 resize-none"
                  rows={3}
                  placeholder="A short intro about yourself…"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  maxLength={500}
                />
                <span className="text-xs text-sage">{form.bio.length}/500</span>
              </label>

              {/* Avatar URL */}
              <label className="block text-sm font-medium text-ink/80">
                Avatar URL <span className="text-sage font-normal">(optional)</span>
                <input
                  id="profile-avatar"
                  className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15"
                  type="url"
                  placeholder="https://…"
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                />
              </label>
            </div>

            {/* Feedback messages */}
            {status === "saved" && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-lime/20 px-4 py-3 text-sm text-forest">
                <span>✅</span> Profile updated successfully!
              </div>
            )}
            {status === "error" && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-blush/10 px-4 py-3 text-sm text-blush">
                <span>⚠️</span> {errorMsg}
              </div>
            )}

            <button
              id="profile-save-btn"
              type="submit"
              disabled={status === "saving"}
              className="mt-6 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "saving" ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving…
                </span>
              ) : (
                "Save changes"
              )}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
