import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { TopNav } from "../components/layout/TopNav";
import {
  authRequest,
  getAdminReviews,
  getAdminReviewStats,
  getAdminAnalytics,
} from "../lib/api";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatProbability } from "../lib/format";
import { ReportDetailsModal } from "../components/shared/ReportDetailsModal";

const ROLE_BADGE = {
  patient: "bg-lime/20 text-forest",
  doctor: "bg-mint/40 text-forest",
  admin: "bg-blush/20 text-blush",
};

function MetricCard({ label, ann, cnn }) {
  return (
    <div className="rounded-xl bg-foam p-4 border border-line">
      <p className="text-xs uppercase tracking-[0.2em] text-sage font-bold">{label}</p>
      <div className="mt-2 flex gap-4">
        <div>
          <p className="text-[10px] text-sage">ANN</p>
          <p className="text-base font-bold text-ink">{(ann * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-sage">CNN</p>
          <p className="text-base font-bold text-ink">{(cnn * 100).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("reviews"); // "reviews" | "users" | "training"

  // User list states
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  // Review states
  const [reviewsList, setReviewsList] = useState([]);
  const [stats, setStats] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState(null);

  // Model training states
  const [trainingStatus, setTrainingStatus] = useState("idle"); // idle | training | done | error
  const [trainingResult, setTrainingResult] = useState(null);
  const [trainingError, setTrainingError] = useState("");

  // Analytics states
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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

  const fetchReviewsAndStats = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const reviewsData = await getAdminReviews(0, 100);
      const statsData = await getAdminReviewStats();
      setReviewsList(reviewsData);
      setStats(statsData);
    } catch (err) {
      console.error("Error loading admin review records:", err);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await getAdminAnalytics();
      setAnalyticsData(data);
    } catch (err) {
      console.error("Error loading admin analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchReviewsAndStats();
    fetchAnalytics();
  }, [fetchUsers, fetchReviewsAndStats, fetchAnalytics]);

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
    { patient: 0, doctor: 0, admin: 0 }
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
                <p className="text-xs uppercase tracking-[0.3em] text-sage font-bold">Admin Control Center</p>
                <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
                  Platform Control Panel 🛡️
                </h1>
                <p className="mt-3 max-w-lg text-sm leading-6 text-ink/68">
                  Monitor patient-doctor clinical consultations, evaluate active review workflows, register databases, and trigger model retraining.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <span className="rounded-full bg-blush/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-blush">
                  Administrator
                </span>
                <span className="text-xs text-sage">{user?.email}</span>
              </div>
            </div>

            {/* General Database counts */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-foam px-4 py-3 text-center border border-line">
                <p className="text-[10px] uppercase tracking-[0.15em] text-sage font-bold">Total Users</p>
                <p className="mt-1 text-2xl font-bold text-ink">{users.length}</p>
              </div>
              <div className="rounded-xl bg-lime/15 px-4 py-3 text-center border border-lime/20">
                <p className="text-[10px] uppercase tracking-[0.15em] text-sage font-bold">Patients</p>
                <p className="mt-1 text-2xl font-bold text-forest">{totalByRole.patient}</p>
              </div>
              <div className="rounded-xl bg-mint/25 px-4 py-3 text-center border border-mint/20">
                <p className="text-[10px] uppercase tracking-[0.15em] text-sage font-bold">Doctors</p>
                <p className="mt-1 text-2xl font-bold text-forest">{totalByRole.doctor}</p>
              </div>
              <div className="rounded-xl bg-blush/10 px-4 py-3 text-center border border-blush/20">
                <p className="text-[10px] uppercase tracking-[0.15em] text-sage font-bold">Admins</p>
                <p className="mt-1 text-2xl font-bold text-blush">{totalByRole.admin}</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-line gap-4 text-sm font-medium">
            <button
              onClick={() => setActiveTab("reviews")}
              className={`pb-2.5 px-1 transition border-b-2 ${
                activeTab === "reviews"
                  ? "border-forest text-forest font-semibold"
                  : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              🩺 Clinical Consultations
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-2.5 px-1 transition border-b-2 ${
                activeTab === "users"
                  ? "border-forest text-forest font-semibold"
                  : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              👤 Registered Users
            </button>
            <button
              onClick={() => setActiveTab("training")}
              className={`pb-2.5 px-1 transition border-b-2 ${
                activeTab === "training"
                  ? "border-forest text-forest font-semibold"
                  : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              🧠 Deep Learning Models
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`pb-2.5 px-1 transition border-b-2 ${
                activeTab === "analytics"
                  ? "border-forest text-forest font-semibold"
                  : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              📈 Platform Analytics
            </button>
          </div>

          {/* Consultation Activity monitor Tab */}
          {activeTab === "reviews" && (
            <div className="space-y-6 animate-scale-up">
              
              {/* Review General statistics */}
              {stats && (
                <div className="grid gap-4 sm:grid-cols-4">
                  {[
                    { label: "Total Reviews Requested", value: stats.total_requests },
                    { label: "Pending Claims", value: stats.pending },
                    { label: "Completed Evaluations", value: stats.completed },
                    { label: "Rejected Requests", value: stats.rejected },
                  ].map((stat, idx) => (
                    <div key={idx} className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">{stat.label}</p>
                      <p className="text-3xl font-extrabold text-ink mt-2">{stat.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Workload stats per doctor */}
              <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft">
                <h3 className="text-xs uppercase tracking-wider text-sage font-bold mb-4">Doctor Workload Statistics</h3>
                {reviewsLoading ? (
                  <div className="flex justify-center py-6">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-forest/20 border-t-forest" />
                  </div>
                ) : !stats || stats.workload.length === 0 ? (
                  <p className="text-xs text-ink/40 py-2 text-center">No active doctor claims recorded.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.workload.map((doc) => (
                      <div key={doc.doctor_id} className="rounded-xl border border-line bg-foam p-4 flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold text-ink">Dr. {doc.doctor_name}</p>
                          <p className="text-[10px] text-sage font-mono mt-0.5">ID: {doc.doctor_id.slice(0, 12)}...</p>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-line/50 pt-3">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-sage font-semibold">Completed</span>
                            <p className="text-sm font-bold text-forest">{doc.completed}</p>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-sage font-semibold">In Progress</span>
                            <p className="text-sm font-bold text-amber-600">{doc.pending}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Consultation requests log tracker list */}
              <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs uppercase tracking-wider text-sage font-bold">Consultation Registry Logs</h3>
                  <button
                    onClick={fetchReviewsAndStats}
                    className="rounded-full border border-line bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink hover:bg-stone-50 transition"
                  >
                    Refresh Logs
                  </button>
                </div>

                {reviewsLoading ? (
                  <div className="flex justify-center py-12">
                    <span className="h-8 w-8 animate-spin rounded-full border-4 border-forest/20 border-t-forest" />
                  </div>
                ) : reviewsList.length === 0 ? (
                  <p className="text-xs text-ink/40 py-8 text-center">No reviews submitted.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-stone-100 border-b border-line text-sage uppercase font-bold text-[10px]">
                        <tr>
                          <th className="p-3">Report ID</th>
                          <th className="p-3">Patient</th>
                          <th className="p-3">Attending Doctor</th>
                          <th className="p-3">Prediction</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line bg-white/30">
                        {reviewsList.map((rev) => (
                          <tr key={rev.review_id} className="hover:bg-white/50 transition">
                            <td className="p-3 font-mono select-all text-[10px]">{rev.report_id.slice(0, 12)}...</td>
                            <td className="p-3 font-medium">
                              <div>
                                <p>{rev.patient_name}</p>
                                <p className="text-[10px] text-sage font-normal">{rev.patient_email}</p>
                              </div>
                            </td>
                            <td className="p-3 text-sage">
                              {rev.doctor_name ? `Dr. ${rev.doctor_name}` : "— Unassigned"}
                            </td>
                            <td className="p-3">
                              <span className="font-semibold">{rev.ai_prediction.predicted_disease}</span>
                              <span className="ml-1.5 text-[9px] font-mono bg-stone-100 border border-line px-1 rounded uppercase text-sage">
                                {rev.ai_prediction.predicted_code}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                rev.status === "reviewed" ? "bg-forest/15 text-forest" :
                                rev.status === "accepted" ? "bg-mint/40 text-forest" :
                                rev.status === "rejected" ? "bg-blush/20 text-blush" :
                                "bg-amber-100 text-amber-800"
                              }`}>
                                {rev.status.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedReportId(rev.report_id)}
                                className="rounded bg-white border border-line px-3 py-1 text-[10px] font-bold text-ink hover:bg-stone-50 transition"
                              >
                                Inspect Case
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Registered Users monitor Tab */}
          {activeTab === "users" && (
            <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl animate-scale-up">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xs uppercase tracking-wider text-sage font-bold">Registered Users Registry</h2>
                <button
                  type="button"
                  onClick={fetchUsers}
                  className="rounded-full border border-line bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink hover:bg-stone-50 transition"
                >
                  Refresh Users
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
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-100 border-b border-line text-sage uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3">Name</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Provider</th>
                        <th className="p-3">Joined Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-white/30">
                      {users.map((u) => (
                        <tr key={u.id} className="transition hover:bg-white/50">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {u.avatar_url ? (
                                <img
                                  src={u.avatar_url}
                                  alt={u.full_name}
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-[9px] font-bold text-white">
                                  {u.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-semibold text-ink">{u.full_name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-sage select-all">{u.email}</td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${
                                ROLE_BADGE[u.role] || "bg-sand text-sage"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3 text-sage capitalize">{u.provider}</td>
                          <td className="p-3 text-sage">
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
          )}

          {/* Model Training panel Tab */}
          {activeTab === "training" && (
            <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl space-y-6 animate-scale-up">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-line pb-4">
                <div>
                  <h2 className="text-base font-bold text-ink">Deep Learning Ensemble Models</h2>
                  <p className="mt-1 text-xs text-sage leading-relaxed">
                    Trigger retraining operations for the ANN and CNN classifier models on the HAM10000 dataset.
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
                <div className="mt-5 rounded-xl border border-lime/30 bg-lime/10 p-4 animate-scale-up">
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
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6 animate-scale-up">
              {analyticsLoading ? (
                <div className="flex justify-center py-12">
                  <span className="h-8 w-8 animate-spin rounded-full border-4 border-forest/20 border-t-forest" />
                </div>
              ) : analyticsData ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">Total API Calls</p>
                      <p className="text-3xl font-extrabold text-ink mt-2">{analyticsData.system_health.total_api_calls}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">API Success Rate</p>
                      <p className="text-3xl font-extrabold text-forest mt-2">{analyticsData.system_health.api_success_rate?.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">Total Scans</p>
                      <p className="text-3xl font-extrabold text-ink mt-2">{analyticsData.summary.total_scans}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">Review Completion</p>
                      <p className="text-3xl font-extrabold text-forest mt-2">{analyticsData.summary.review_completion_rate?.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="rounded-2xl border border-line bg-white/70 p-6 shadow-soft">
                      <h3 className="text-xs uppercase tracking-wider text-sage font-bold mb-4">Scan Trends Over Time</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analyticsData.scan_trends}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="date" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Area type="monotone" dataKey="scans" stroke="#2D5A27" fill="#2D5A27" fillOpacity={0.2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-line bg-white/70 p-6 shadow-soft">
                      <h3 className="text-xs uppercase tracking-wider text-sage font-bold mb-4">Top Disease Predictions</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analyticsData.disease_distribution} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                            <XAxis type="number" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <YAxis dataKey="disease" type="category" width={100} tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Bar dataKey="count" fill="#8B9D83" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="rounded-2xl border border-line bg-white/70 p-6 shadow-soft">
                      <h3 className="text-xs uppercase tracking-wider text-sage font-bold mb-4">Active Users Over Time</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analyticsData.active_users_trends}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="date" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Area type="monotone" dataKey="active_users" stroke="#607D8B" fill="#607D8B" fillOpacity={0.2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="rounded-2xl border border-line bg-white/70 p-6 shadow-soft">
                      <h3 className="text-xs uppercase tracking-wider text-sage font-bold mb-4">AI Model Usage</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData.model_usage}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="count"
                              nameKey="model"
                            >
                              {analyticsData.model_usage?.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#2D5A27', '#8B9D83', '#E0A96D'][index % 3]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 mt-2">
                          {analyticsData.model_usage?.map((entry, index) => (
                            <div key={index} className="flex items-center gap-1 text-xs text-sage">
                              <div className="w-2 h-2 rounded-full" style={{backgroundColor: ['#2D5A27', '#8B9D83', '#E0A96D'][index % 3]}}></div>
                              {entry.model}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-ink/50 py-10">Failed to load analytics data.</p>
              )}
            </div>
          )}

          {/* Quick links */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { to: "/scanner", icon: "📷", label: "Run Live Scanner", desc: "Launch camera hardware scanner scan" },
              { to: "/profile", icon: "👤", label: "Admin Profile", desc: "Update your account details" },
              { href: "/docs", icon: "📘", label: "API Docs Reference", desc: "Interactive Swagger API documentation" },
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

      {/* Report details inspector modal overlay */}
      {selectedReportId && (
        <ReportDetailsModal
          reportId={selectedReportId}
          onClose={() => setSelectedReportId(null)}
          onUpdate={fetchReviewsAndStats}
        />
      )}
    </div>
  );
}
