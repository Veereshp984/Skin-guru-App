import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { TopNav } from "../components/layout/TopNav";
import { getPatientReviews, getPatientAnalytics } from "../lib/api";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatProbability } from "../lib/format";
import { ReportDetailsModal } from "../components/shared/ReportDetailsModal";

const tips = [
  {
    icon: "🔍",
    title: "Check monthly",
    desc: "Examine your skin once a month in good lighting, including hard-to-see areas.",
  },
  {
    icon: "📏",
    title: "Remember ABCDE",
    desc: "Asymmetry, Border, Colour, Diameter, Evolution — the five warning signs of melanoma.",
  },
  {
    icon: "☀️",
    title: "Sun protection",
    desc: "Use SPF 30+ sunscreen daily, wear protective clothing, and avoid peak-sun hours.",
  },
  {
    icon: "👨‍⚕️",
    title: "Consult a doctor",
    desc: "SkinGuru AI provides a screening aid — always follow up suspicious findings with a clinician.",
  },
];

const CONDITION_FACTS = [
  { code: "MEL", name: "Melanoma", risk: "High", color: "bg-blush/15 text-blush" },
  { code: "BCC", name: "Basal Cell", risk: "Moderate", color: "bg-lime/20 text-forest" },
  { code: "AK", name: "Actinic Keratosis", risk: "Pre-cancerous", color: "bg-mint/40 text-forest" },
  { code: "DF", name: "Dermatofibroma", risk: "Benign", color: "bg-foam text-sage" },
];

function DashCard({ icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 text-2xl">{icon}</div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-sage">{desc}</p>
    </div>
  );
}

export function PatientDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("reviews"); // "reviews" | "guidelines" | "analytics"
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedReportId, setSelectedReportId] = useState(null);

  // Analytics states
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    async function loadAnalytics() {
      if (activeTab === "analytics" && !analyticsData) {
        setAnalyticsLoading(true);
        try {
          const data = await getPatientAnalytics();
          setAnalyticsData(data);
        } catch (err) {
          console.error("Error fetching patient analytics:", err);
        } finally {
          setAnalyticsLoading(false);
        }
      }
    }
    loadAnalytics();
  }, [activeTab, analyticsData]);

  useEffect(() => {
    async function loadReviews() {
      try {
        setLoading(true);
        const data = await getPatientReviews();
        setReviews(data);
      } catch (err) {
        console.error("Error fetching patient reviews:", err);
        setError("Failed to load clinical consultations.");
      } finally {
        setLoading(false);
      }
    }
    loadReviews();
  }, []);

  function handleReportUpdated(updatedReport) {
    // Reload reviews when a report is updated (e.g. review requested)
    getPatientReviews()
      .then(setReviews)
      .catch(console.error);
  }

  // Count active notifications/completed reviews
  const completedReviews = reviews.filter((r) => r.status === "reviewed");

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-6rem] top-[10rem] h-80 w-80 rounded-full bg-white/40 blur-3xl" />
        <div className="absolute bottom-[-4rem] right-[-3rem] h-72 w-72 rounded-full bg-lime/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-20 pt-4 sm:px-6 xl:px-8">
        <TopNav />

        <main className="mx-auto mt-6 max-w-5xl space-y-6">
          {/* Welcome hero */}
          <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl sm:p-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sage font-bold">Patient Portal</p>
                <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
                  Welcome, {user?.full_name?.split(" ")[0]} 👋
                </h1>
                <p className="mt-3 max-w-lg text-base leading-7 text-ink/68">
                  Your personal skin health dashboard. Upload a photo or use the webcam to get an AI screening, and send reports directly for clinical review.
                </p>
              </div>
              <div className="shrink-0 flex flex-col gap-2">
                <Link
                  to="/scanner"
                  id="patient-new-scan-btn"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  📷 Live camera scan
                </Link>
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white/80 px-6 py-2.5 text-xs font-semibold text-ink transition hover:bg-stone-50"
                >
                  🔬 Upload image scan
                </Link>
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { label: "Consultation Cases", value: reviews.length },
                { label: "Completed Reviews", value: completedReviews.length },
                { label: "Pending Reviews", value: reviews.length - completedReviews.length },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-foam px-4 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-sage font-bold">{s.label}</p>
                  <p className="mt-1 text-xl font-bold text-ink">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Completed consultation banner notification */}
          {completedReviews.length > 0 && (
            <div className="rounded-2xl border border-lime/30 bg-lime/10 p-4 flex items-center justify-between gap-3 animate-rise">
              <div className="flex items-center gap-2 text-forest">
                <span className="text-xl">🔔</span>
                <p className="text-sm font-semibold">
                  You have {completedReviews.length} completed clinical reports signed off by attending dermatologists.
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider bg-forest/15 px-2 py-0.5 rounded text-forest font-bold font-mono">
                Update
              </span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-line gap-4 text-sm font-medium overflow-x-auto">
            <button
              onClick={() => setActiveTab("reviews")}
              className={`pb-2.5 px-1 transition border-b-2 whitespace-nowrap ${
                activeTab === "reviews"
                  ? "border-forest text-forest font-semibold"
                  : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              📋 Clinical Consultations
            </button>
            <button
              onClick={() => setActiveTab("guidelines")}
              className={`pb-2.5 px-1 transition border-b-2 whitespace-nowrap ${
                activeTab === "guidelines"
                  ? "border-forest text-forest font-semibold"
                  : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              💡 Skin Care & Tips
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`pb-2.5 px-1 transition border-b-2 whitespace-nowrap ${
                activeTab === "analytics"
                  ? "border-forest text-forest font-semibold"
                  : "border-transparent text-ink/50 hover:text-ink"
              }`}
            >
              📈 My Health Analytics
            </button>
          </div>

          {/* Tab contents */}
          {activeTab === "reviews" && (
            <section className="space-y-4 animate-scale-up">
              <h2 className="text-xs uppercase tracking-[0.3em] text-sage font-bold">Consultation History</h2>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-3xl border border-white/60">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-lime/30 border-t-lime" />
                  <p className="mt-4 text-xs text-sage">Loading your reviews...</p>
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 text-center text-rose-700">
                  <p>{error}</p>
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-line bg-white/50 px-6 py-16 text-center backdrop-blur-md">
                  <span className="text-4xl block">🩺</span>
                  <h3 className="mt-4 text-base font-semibold text-ink">No review requests submitted</h3>
                  <p className="mt-2 text-xs text-ink/50 max-w-sm mx-auto">
                    To get expert dermatologist feedback, complete an AI scan and request a Clinical review inside the report.
                  </p>
                  <Link
                    to="/scanner"
                    className="mt-6 inline-flex rounded-full bg-forest px-6 py-2.5 text-xs font-semibold text-white shadow-soft transition hover:-translate-y-0.5"
                  >
                    Start Scanner Scan
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {reviews.map((rev) => (
                    <article
                      key={rev.review_id}
                      onClick={() => setSelectedReportId(rev.report_id)}
                      className="rounded-3xl border border-white/60 bg-white/50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md cursor-pointer hover:bg-white/80 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-sage font-mono">Report ID: {rev.report_id.slice(0, 8)}</p>
                            <h3 className="text-base font-semibold mt-1 text-ink">{rev.ai_prediction.predicted_disease}</h3>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            rev.status === "reviewed" ? "bg-forest/15 text-forest" :
                            rev.status === "accepted" ? "bg-mint/40 text-forest" :
                            rev.status === "rejected" ? "bg-blush/20 text-blush" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {rev.status.replace(/_/g, " ")}
                          </span>
                        </div>

                        <div className="mt-4 border-t border-line pt-4 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-ink/40 uppercase font-semibold text-[8px]">AI Confidence</p>
                            <p className="text-xs font-bold text-ink">{formatProbability(rev.ai_prediction.confidence)}</p>
                          </div>
                          <div>
                            <p className="text-ink/40 uppercase font-semibold text-[8px]">Request Date</p>
                            <p className="text-xs text-ink">{new Date(rev.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {rev.doctor_name && (
                          <div className="mt-3 text-xs text-sage flex items-center gap-1.5">
                            <span>🩺</span>
                            <span>Attending Doctor: <b>Dr. {rev.doctor_name}</b></span>
                          </div>
                        )}
                      </div>

                      {rev.status === "reviewed" && (
                        <div className="mt-4 border-t border-line pt-3 flex items-center justify-between text-xs">
                          <span className="text-forest font-semibold">✓ Diagnosis Submitted</span>
                          <span className="text-forest hover:underline font-bold text-[11px]">View Feedback →</span>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "guidelines" && (
            <div className="space-y-6 animate-scale-up">
              {/* Skin health tips */}
              <section>
                <h2 className="mb-4 text-xs uppercase tracking-[0.3em] text-sage font-bold">Skin health guidelines</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {tips.map((t) => (
                    <DashCard key={t.title} {...t} />
                  ))}
                </div>
              </section>

              {/* Condition reference */}
              <section>
                <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl">
                  <h2 className="text-base font-semibold">Skin Condition Reference</h2>
                  <p className="mt-1 text-sm text-sage">Common skin conditions the AI model can identify.</p>
                  <div className="mt-4 space-y-3">
                    {CONDITION_FACTS.map((c) => (
                      <div
                        key={c.code}
                        className="flex items-center justify-between rounded-xl bg-foam px-4 py-3"
                      >
                        <div>
                          <span className="font-mono text-xs font-bold text-sage">{c.code}</span>
                          <span className="ml-3 text-sm font-medium text-ink">{c.name}</span>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.color}`}>{c.risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "analytics" && (
            <section className="space-y-6 animate-scale-up">
              <h2 className="text-xs uppercase tracking-[0.3em] text-sage font-bold">Health History Analytics</h2>
              {analyticsLoading ? (
                <div className="flex justify-center py-12">
                  <span className="h-8 w-8 animate-spin rounded-full border-4 border-forest/20 border-t-forest" />
                </div>
              ) : analyticsData ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">Total Scans Performed</p>
                      <p className="text-3xl font-extrabold text-ink mt-2">{analyticsData.summary.total_scans}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">Completed Reviews</p>
                      <p className="text-3xl font-extrabold text-forest mt-2">{analyticsData.summary.reviewed_scans}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">Pending Reviews</p>
                      <p className="text-3xl font-extrabold text-amber-600 mt-2">{analyticsData.summary.pending_reviews}</p>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="rounded-2xl border border-line bg-white/70 p-6 shadow-soft">
                      <h3 className="text-xs uppercase tracking-wider text-sage font-bold mb-4">My Scan Activity History</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analyticsData.monthly_activity}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="month" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Area type="monotone" dataKey="scans" stroke="#607D8B" fill="#607D8B" fillOpacity={0.2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-line bg-white/70 p-6 shadow-soft">
                      <h3 className="text-xs uppercase tracking-wider text-sage font-bold mb-4">My Prediction Types</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData.common_predictions}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="count"
                              nameKey="disease"
                            >
                              {analyticsData.common_predictions?.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#2D5A27', '#8B9D83', '#E0A96D'][index % 3]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 mt-2 flex-wrap">
                          {analyticsData.common_predictions?.map((entry, index) => (
                            <div key={index} className="flex items-center gap-1 text-[10px] text-sage">
                              <div className="w-2 h-2 rounded-full" style={{backgroundColor: ['#2D5A27', '#8B9D83', '#E0A96D'][index % 3]}}></div>
                              {entry.disease}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-ink/50 py-10">Failed to load health analytics.</p>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Report Modal details details */}
      {selectedReportId && (
        <ReportDetailsModal
          reportId={selectedReportId}
          onClose={() => setSelectedReportId(null)}
          onUpdate={handleReportUpdated}
        />
      )}
    </div>
  );
}
