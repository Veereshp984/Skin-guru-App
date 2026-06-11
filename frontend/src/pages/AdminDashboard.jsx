import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { TopNav } from "../components/layout/TopNav";
import { authRequest } from "../lib/api";

const ROLE_BADGE = {
  patient: "bg-lime/20 text-forest",
  doctor: "bg-mint/40 text-forest",
  admin: "bg-blush/20 text-blush",
};

function MetricCard({ label, ann, cnn }) {
  return (
    <div className="rounded-xl bg-foam p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-sage">{label}</p>
      <div className="mt-2 flex gap-4">
        <div>
          <p className="text-[10px] text-sage">ANN</p>
          <p className="text-lg font-bold text-ink">{(ann * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-sage">CNN</p>
          <p className="text-lg font-bold text-ink">{(cnn * 100).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  const [trainingStatus, setTrainingStatus] = useState("idle"); // idle | training | done | error
  const [trainingResult, setTrainingResult] = useState(null);
  const [trainingError, setTrainingError] = useState("");

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const data = await authRequest("/api/admin/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setUsersError(err.message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleTrainModels() {
    setTrainingStatus("training");
    setTrainingResult(null);
    setTrainingError("");
    try {
      const result = await authRequest("/api/models/train", { method: "POST" });
      setTrainingResult(result);
      setTrainingStatus("done");
    } catch (err) {
      setTrainingError(err.message);
      setTrainingStatus("error");
    }
  }

  const totalByRole = users.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    },
    { patient: 0, doctor: 0, admin: 0 },
  );

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-32 h-80 w-80 rounded-full bg-white/40 blur-3xl" />
        <div className="absolute -bottom-20 right-4 h-96 w-96 rounded-full bg-blush/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-20 pt-4 sm:px-6 xl:px-8">
        <TopNav />

        <main className="mx-auto mt-6 max-w-6xl space-y-6">
          {/* Welcome hero */}
          <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl sm:p-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sage">Admin Control Panel</p>
                <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
                  Admin Panel 🛡️
                </h1>
                <p className="mt-3 max-w-lg text-base leading-7 text-ink/68">
                  Manage users, monitor the system, and trigger model retraining. Full administrative access.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <span className="rounded-full bg-blush/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-blush">
                  Admin
                </span>
                <span className="text-xs text-sage">{user?.email}</span>
              </div>
            </div>

            {/* System stats */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-foam px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-sage">Total Users</p>
                <p className="mt-1 text-2xl font-bold text-ink">{users.length}</p>
              </div>
              <div className="rounded-xl bg-lime/15 px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-sage">Patients</p>
                <p className="mt-1 text-2xl font-bold text-forest">{totalByRole.patient}</p>
              </div>
              <div className="rounded-xl bg-mint/25 px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-sage">Doctors</p>
                <p className="mt-1 text-2xl font-bold text-forest">{totalByRole.doctor}</p>
              </div>
              <div className="rounded-xl bg-blush/10 px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-sage">Admins</p>
                <p className="mt-1 text-2xl font-bold text-blush">{totalByRole.admin}</p>
              </div>
            </div>
          </div>

          {/* Model Training panel */}
          <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Model Training</h2>
                <p className="mt-1 text-sm text-sage">
                  Retrain the ANN and CNN ensemble models from the HAM10000 dataset. This may take several minutes.
                </p>
              </div>
              <button
                id="admin-train-btn"
                type="button"
                onClick={handleTrainModels}
                disabled={trainingStatus === "training"}
                className="shrink-0 inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {trainingStatus === "training" ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Training…
                  </>
                ) : (
                  <>🧠 Train models</>
                )}
              </button>
            </div>

            {/* Training result */}
            {trainingStatus === "done" && trainingResult && (
              <div className="mt-5 rounded-xl border border-lime/30 bg-lime/10 p-4">
                <p className="mb-3 text-sm font-semibold text-forest">
                  ✅ Training complete — {trainingResult.message}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricCard
                    label="Accuracy"
                    ann={trainingResult.ann?.accuracy ?? 0}
                    cnn={trainingResult.cnn?.accuracy ?? 0}
                  />
                  <MetricCard
                    label="Val Accuracy"
                    ann={trainingResult.ann?.val_accuracy ?? 0}
                    cnn={trainingResult.cnn?.val_accuracy ?? 0}
                  />
                  <MetricCard
                    label="Loss"
                    ann={trainingResult.ann?.loss ?? 0}
                    cnn={trainingResult.cnn?.loss ?? 0}
                  />
                  <MetricCard
                    label="Val Loss"
                    ann={trainingResult.ann?.val_loss ?? 0}
                    cnn={trainingResult.cnn?.val_loss ?? 0}
                  />
                </div>
              </div>
            )}

            {trainingStatus === "error" && (
              <div className="mt-4 rounded-xl bg-blush/10 px-4 py-3 text-sm text-blush">
                ⚠️ Training failed: {trainingError}
              </div>
            )}
          </div>

          {/* User Management */}
          <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Registered Users</h2>
              <button
                type="button"
                onClick={fetchUsers}
                className="rounded-full border border-line bg-white px-4 py-2 text-xs font-medium text-ink transition hover:bg-sand"
              >
                ↻ Refresh
              </button>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-4 border-forest/20 border-t-forest" />
              </div>
            ) : usersError ? (
              <div className="rounded-xl bg-blush/10 px-4 py-3 text-sm text-blush">⚠️ {usersError}</div>
            ) : users.length === 0 ? (
              <p className="py-8 text-center text-sm text-sage">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-sage">Name</th>
                      <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-sage">Email</th>
                      <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-sage">Role</th>
                      <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-sage">Provider</th>
                      <th className="pb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sage">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {users.map((u) => (
                      <tr key={u.id} className="transition hover:bg-foam/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.full_name}
                                className="h-7 w-7 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-[10px] font-bold text-white">
                                {u.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-ink">{u.full_name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-sage">{u.email}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                              ROLE_BADGE[u.role] || "bg-sand text-sage"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-sage capitalize">{u.provider}</td>
                        <td className="py-3 text-sage">
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { to: "/app", icon: "🔬", label: "Run AI Scan", desc: "Test the skin screening tool" },
              { to: "/profile", icon: "👤", label: "Admin Profile", desc: "Update your account details" },
              { href: "/docs", icon: "📘", label: "API Docs", desc: "View FastAPI interactive docs" },
            ].map((link) => {
              const cls =
                "flex items-start gap-4 rounded-2xl border border-white/70 bg-white/60 p-5 shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md";
              const inner = (
                <>
                  <span className="text-2xl">{link.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{link.label}</p>
                    <p className="mt-0.5 text-xs text-sage">{link.desc}</p>
                  </div>
                </>
              );
              return link.to ? (
                <Link key={link.label} to={link.to} className={cls}>
                  {inner}
                </Link>
              ) : (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className={cls}>
                  {inner}
                </a>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
