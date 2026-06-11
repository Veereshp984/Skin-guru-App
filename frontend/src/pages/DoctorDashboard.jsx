import { useState, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { TopNav } from "../components/layout/TopNav";
import {
  getDoctorReviews,
  submitDoctorReviewData,
  updateReviewRequestStatus,
  getReportImageUrl,
  getDoctorAnalytics,
} from "../lib/api";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatProbability } from "../lib/format";

// Zoom component for secure medical images
function SecureZoomImage({ reportId }) {
  const [url, setUrl] = useState("");
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const [isZooming, setIsZooming] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const secureUrl = await getReportImageUrl(reportId);
      if (active && secureUrl) {
        setUrl(secureUrl);
      }
    }
    load();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [reportId]);

  function handleMouseMove(e) {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  }

  return (
    <div className="relative w-full aspect-square overflow-hidden rounded-3xl border border-line bg-stone-100 flex items-center justify-center">
      {url ? (
        <div
          className="relative w-full h-full cursor-zoom-in"
          onMouseEnter={() => setIsZooming(true)}
          onMouseLeave={() => setIsZooming(false)}
          onMouseMove={handleMouseMove}
        >
          <img
            src={url}
            alt="Lesion details"
            className="w-full h-full object-cover transition-opacity duration-300"
            style={{ opacity: isZooming ? 0.2 : 1 }}
          />
          {isZooming && (
            <div
              className="absolute inset-0 pointer-events-none rounded-3xl border border-lime shadow-halo"
              style={{
                backgroundImage: `url(${url})`,
                backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                backgroundSize: "280%",
                backgroundRepeat: "no-repeat",
              }}
            />
          )}
        </div>
      ) : (
        <div className="text-center p-4">
          <span className="text-4xl">📸</span>
          <p className="mt-2 text-xs text-ink/40">Loading secure capture...</p>
        </div>
      )}
    </div>
  );
}

export function DoctorDashboard() {
  const { user } = useAuth();

  // Consultation records
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Active studio case
  const [activeReviewId, setActiveReviewId] = useState(null);
  const [activeReview, setActiveReview] = useState(null);

  // Analytics states
  const [activeTab, setActiveTab] = useState("clinical");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    async function loadAnalytics() {
      if (activeTab === "analytics" && !analyticsData) {
        setAnalyticsLoading(true);
        try {
          const data = await getDoctorAnalytics();
          setAnalyticsData(data);
        } catch (err) {
          console.error("Error loading doctor analytics:", err);
        } finally {
          setAnalyticsLoading(false);
        }
      }
    }
    loadAnalytics();
  }, [activeTab, analyticsData]);

  // Studio form inputs
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Load reviews on filter/search change
  useEffect(() => {
    async function loadReviews() {
      try {
        setLoading(true);
        const data = await getDoctorReviews(statusFilter, searchQuery);
        setReviews(data);
      } catch (err) {
        console.error("Error loading reviews:", err);
        setError("Failed to fetch doctor review records.");
      } finally {
        setLoading(false);
      }
    }
    const delayDebounce = setTimeout(() => {
      loadReviews();
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [statusFilter, searchQuery]);

  // Load active review details into studio
  useEffect(() => {
    if (!activeReviewId) {
      setActiveReview(null);
      return;
    }
    const current = reviews.find((r) => r.review_id === activeReviewId);
    if (current) {
      setActiveReview(current);
      setDiagnosis(current.doctor_diagnosis || "");
      setNotes(current.doctor_notes || "");
      setRecommendations(current.recommendations || "");
      setSubmitSuccess("");
      setSubmitError("");
    }
  }, [activeReviewId, reviews]);

  async function handleClaim(reviewId) {
    try {
      setError("");
      await updateReviewRequestStatus(reviewId, "accepted");
      // Refresh list
      const data = await getDoctorReviews(statusFilter, searchQuery);
      setReviews(data);
      setActiveReviewId(reviewId);
    } catch (err) {
      setError(err.message || "Failed to claim case.");
    }
  }

  async function handleReject(reviewId) {
    if (!confirm("Are you sure you want to reject/release this review request?")) {
      return;
    }
    try {
      setError("");
      await updateReviewRequestStatus(reviewId, "rejected");
      if (activeReviewId === reviewId) {
        setActiveReviewId(null);
      }
      const data = await getDoctorReviews(statusFilter, searchQuery);
      setReviews(data);
    } catch (err) {
      setError(err.message || "Failed to release case.");
    }
  }

  async function handleSaveReview(targetStatus) {
    if (!diagnosis.trim() || !notes.trim() || !recommendations.trim()) {
      setSubmitError("All evaluation fields (Diagnosis, Notes, Recommendations) must be completed.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");
      setSubmitSuccess("");

      const payload = {
        doctor_diagnosis: diagnosis,
        doctor_notes: notes,
        recommendations: recommendations,
        status: targetStatus, // "accepted" (draft) or "reviewed" or "requires_further_examination"
      };

      const updated = await submitDoctorReviewData(activeReviewId, payload);
      setSubmitSuccess(
        targetStatus === "accepted" ? "Draft saved successfully!" : "Review finalized and locked."
      );

      // Refresh list to sync details
      const data = await getDoctorReviews(statusFilter, searchQuery);
      setReviews(data);
      
      if (targetStatus !== "accepted") {
        // Clear active selection on finalization
        setTimeout(() => {
          setActiveReviewId(null);
        }, 1200);
      }
    } catch (err) {
      setSubmitError(err.message || "Failed to submit review data.");
    } finally {
      setSubmitting(false);
    }
  }

  // Segment reviews
  const myAssignedReviews = reviews.filter((r) => r.doctor_id === str(user?._id));
  const unassignedReviews = reviews.filter((r) => r.doctor_id === null && r.status === "pending");

  function str(val) {
    return val ? String(val) : "";
  }

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-32 h-80 w-80 rounded-full bg-white/40 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-96 w-96 rounded-full bg-mint/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-20 pt-4 sm:px-6 xl:px-8">
        <TopNav />

        <main className="mt-6 space-y-6">
          {/* Header card */}
          <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sage font-bold">Clinical Workspace</p>
                <h1 className="mt-2 font-display text-2xl leading-none text-forest">
                  Dermatologist Studio 🩺
                </h1>
                <p className="text-xs text-sage mt-2">
                  Claim pending cases, review machine-learning differential probabilities, and track your analytics.
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-4 text-sm font-medium border-b border-line">
              <button
                onClick={() => setActiveTab("clinical")}
                className={`pb-2.5 px-1 transition border-b-2 ${
                  activeTab === "clinical"
                    ? "border-forest text-forest font-semibold"
                    : "border-transparent text-ink/50 hover:text-ink"
                }`}
              >
                🩺 Clinical Queue
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`pb-2.5 px-1 transition border-b-2 ${
                  activeTab === "analytics"
                    ? "border-forest text-forest font-semibold"
                    : "border-transparent text-ink/50 hover:text-ink"
                }`}
              >
                📈 My Performance Analytics
              </button>
            </div>
          </div>

          {activeTab === "clinical" ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr] xl:grid-cols-[0.9fr_1.4fr]">
              
              {/* Left Box: Case Lists Queues */}
              <section className="space-y-6">

              {/* Filters Toolbar */}
              <div className="rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm backdrop-blur-md space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Patient name or Report ID..."
                    className="flex-1 rounded-xl border border-line bg-white/80 p-2.5 text-xs text-ink focus:outline-none"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-line bg-white/80 p-2.5 text-xs text-ink focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending Claim</option>
                    <option value="accepted">Claimed / Drafts</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="requires_further_examination">Further Examination</option>
                  </select>
                </div>
              </div>

              {/* Error Box */}
              {error && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-700">
                  {error}
                </div>
              )}

              {/* Unassigned review requests list */}
              <div className="rounded-3xl border border-white/60 bg-white/50 p-5 shadow-sm">
                <h2 className="text-xs uppercase tracking-wider text-sage font-bold mb-3">Available Consultations ({unassignedReviews.length})</h2>
                {loading && reviews.length === 0 ? (
                  <div className="flex justify-center py-6">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-forest/20 border-t-forest" />
                  </div>
                ) : unassignedReviews.length === 0 ? (
                  <p className="text-xs text-ink/40 py-4 text-center">No unassigned cases available to claim.</p>
                ) : (
                  <div className="space-y-3">
                    {unassignedReviews.map((rev) => (
                      <div
                        key={rev.review_id}
                        className="rounded-2xl border border-line bg-white/70 p-4 flex justify-between items-center gap-3 transition hover:bg-white"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] text-sage font-semibold uppercase tracking-wider">Patient: {rev.patient_name}</p>
                          <h4 className="text-sm font-bold text-ink truncate mt-1">{rev.ai_prediction.predicted_disease}</h4>
                          <span className="inline-block rounded bg-stone-100 border border-line px-1.5 py-0.2 text-[8px] font-mono uppercase text-sage">
                            Conf: {formatProbability(rev.ai_prediction.confidence)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleClaim(rev.review_id)}
                          className="shrink-0 rounded-full bg-forest px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          Claim Case
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* My Assigned reviews list */}
              <div className="rounded-3xl border border-white/60 bg-white/50 p-5 shadow-sm">
                <h2 className="text-xs uppercase tracking-wider text-sage font-bold mb-3">My Assigned Cases ({myAssignedReviews.length})</h2>
                {loading && reviews.length === 0 ? (
                  <div className="flex justify-center py-6">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-forest/20 border-t-forest" />
                  </div>
                ) : myAssignedReviews.length === 0 ? (
                  <p className="text-xs text-ink/40 py-4 text-center">You have no active cases claimed or assigned.</p>
                ) : (
                  <div className="space-y-3">
                    {myAssignedReviews.map((rev) => (
                      <div
                        key={rev.review_id}
                        onClick={() => setActiveReviewId(rev.review_id)}
                        className={`rounded-2xl border p-4 flex justify-between items-center gap-3 transition hover:bg-white cursor-pointer ${
                          activeReviewId === rev.review_id
                            ? "border-forest bg-forest/5 shadow-sm"
                            : "border-line bg-white/70"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] text-sage font-semibold uppercase tracking-wider">Patient: {rev.patient_name}</p>
                          <h4 className="text-sm font-bold text-ink truncate mt-1">{rev.ai_prediction.predicted_disease}</h4>
                          <span className="inline-block rounded bg-stone-100 border border-line px-1.5 py-0.2 text-[8px] font-mono uppercase text-sage">
                            Status: {rev.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleReject(rev.review_id)}
                            className="p-2 text-xs rounded-full border border-line bg-white hover:bg-rose-50 hover:border-rose-200 transition"
                            title="Reject/Release case review request"
                          >
                            🚪
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </section>

            {/* Right Box: Case Studio Workspace */}
            <section>
              {activeReview ? (
                <div className="rounded-[36px] border border-white/70 bg-white/70 p-6 shadow-soft backdrop-blur-xl space-y-6 animate-scale-up">
                  
                  {/* Studio Header */}
                  <div className="border-b border-line pb-4 flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-sage bg-foam px-2.5 py-1 rounded-full border border-line">
                        Clinical Consultation studio
                      </span>
                      <h2 className="mt-2 text-xl font-bold text-ink truncate">
                        Case: {activeReview.patient_name}
                      </h2>
                      <p className="text-[10px] text-sage font-mono mt-1 select-all">Report ID: {activeReview.report_id}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveReviewId(null)}
                      className="text-xs text-sage hover:underline"
                    >
                      Close Workspace
                    </button>
                  </div>

                  {/* Body Workspace Grid */}
                  <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]">
                    
                    {/* Left Grid: Magnifying Image Viewer */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-sage">Lesion Magnifier</h4>
                      <SecureZoomImage reportId={activeReview.report_id} />
                      <div className="text-[10px] text-center text-sage font-medium">
                        Hover over image area to trigger 2.8x diagnostic magnifier
                      </div>

                      {/* AI predictions metrics */}
                      <div className="rounded-2xl border border-line bg-foam p-4 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-sage">AI Prediction</h4>
                        <div className="flex justify-between text-xs py-1 border-b border-line/40">
                          <span className="text-sage">Top Match</span>
                          <span className="font-bold text-ink">{activeReview.ai_prediction.predicted_disease}</span>
                        </div>
                        <div className="flex justify-between text-xs py-1 border-b border-line/40">
                          <span className="text-sage">Confidence</span>
                          <span className="font-bold text-lime font-mono">{formatProbability(activeReview.ai_prediction.confidence)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-sage">AI Status</span>
                          <span className="inline-block bg-lime/20 text-forest font-bold font-mono text-[9px] px-2 py-0.2 rounded uppercase">
                            verified scan
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Grid: Form details */}
                    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-sage">Clinical Assessment Remarks</h4>
                      
                      {/* Patient metadata */}
                      <div className="rounded-xl border border-line bg-stone-50/50 p-3 text-xs space-y-1">
                        <p className="text-sage">Patient Email: <span className="font-bold text-ink select-all">{activeReview.patient_email}</span></p>
                        <p className="text-sage">Submitted Date: <span className="font-bold text-ink">{new Date(activeReview.created_at).toLocaleString()}</span></p>
                      </div>

                      {/* Diagnostic Remarks input */}
                      <div>
                        <label className="block text-[10px] font-semibold text-ink/70 mb-1 uppercase tracking-wider">Clinical Diagnosis</label>
                        <input
                          type="text"
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                          disabled={activeReview.status === "reviewed"}
                          placeholder="e.g., Melanocytic Nevi (NV) showing regular borders"
                          className="w-full rounded-xl border border-line bg-white p-2.5 text-xs text-ink focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
                        />
                      </div>

                      {/* Doctor Notes input */}
                      <div>
                        <label className="block text-[10px] font-semibold text-ink/70 mb-1 uppercase tracking-wider">Clinical Notes / remarks</label>
                        <textarea
                          rows="3"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          disabled={activeReview.status === "reviewed"}
                          placeholder="Describe lesion characteristics, borders, asymmetry patterns, and general clinical observations..."
                          className="w-full rounded-2xl border border-line bg-white p-3 text-xs text-ink focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
                        />
                      </div>

                      {/* Recommendations input */}
                      <div>
                        <label className="block text-[10px] font-semibold text-ink/70 mb-1 uppercase tracking-wider">Care Instructions & Follow-up warnings</label>
                        <textarea
                          rows="3"
                          value={recommendations}
                          onChange={(e) => setRecommendations(e.target.value)}
                          disabled={activeReview.status === "reviewed"}
                          placeholder="Prescribe skin care routines, SPF recommendations, monitoring schedules, and urgent check-up warnings..."
                          className="w-full rounded-2xl border border-line bg-white p-3 text-xs text-ink focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
                        />
                      </div>

                      {/* Success / Error alerts */}
                      {submitError && (
                        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                          {submitError}
                        </div>
                      )}
                      {submitSuccess && (
                        <div className="rounded-xl border border-lime/30 bg-lime/10 p-3 text-xs text-forest">
                          {submitSuccess}
                        </div>
                      )}

                      {/* Action buttons */}
                      {activeReview.status !== "reviewed" ? (
                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => handleSaveReview("accepted")} // accepted is draft mode
                            disabled={submitting}
                            className="flex-1 rounded-full border border-line bg-white py-3 text-xs font-semibold text-ink transition hover:bg-stone-50 disabled:opacity-50"
                          >
                            Save Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveReview("reviewed")} // final lock
                            disabled={submitting}
                            className="flex-1 rounded-full bg-forest py-3 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
                          >
                            {submitting ? "Submitting..." : "Finalize & Sign Off"}
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-line bg-stone-100 p-4 text-center text-xs text-sage font-medium">
                          🔒 This assessment is finalized and locked for medical records compliance.
                        </div>
                      )}

                    </form>

                  </div>

                </div>
              ) : (
                <div className="rounded-[40px] border border-dashed border-line bg-white/50 px-6 py-24 text-center backdrop-blur-md flex flex-col items-center justify-center">
                  <span className="text-4xl block">🩺</span>
                  <h3 className="mt-4 text-base font-semibold text-ink">No Case Selected</h3>
                  <p className="mt-2 text-xs text-ink/50 max-w-sm">
                    Select one of your assigned cases from the left panel to load the assessment form and image magnifier.
                  </p>
                </div>
              )}
              
            </section>

          </div>
          ) : (
            <div className="space-y-6 animate-scale-up">
              {analyticsLoading ? (
                <div className="flex justify-center py-12">
                  <span className="h-8 w-8 animate-spin rounded-full border-4 border-forest/20 border-t-forest" />
                </div>
              ) : analyticsData ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">Completed Cases</p>
                      <p className="text-3xl font-extrabold text-forest mt-2">{analyticsData.summary.completed_reviews}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">Pending Reviews</p>
                      <p className="text-3xl font-extrabold text-amber-600 mt-2">{analyticsData.summary.pending_reviews}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-line p-5 shadow-sm text-center">
                      <p className="text-[10px] uppercase tracking-wider text-sage font-bold">Unique Patients</p>
                      <p className="text-3xl font-extrabold text-ink mt-2">{analyticsData.summary.unique_patients_assisted}</p>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="rounded-2xl border border-line bg-white/70 p-6 shadow-soft">
                      <h3 className="text-xs uppercase tracking-wider text-sage font-bold mb-4">My Diagnoses Distribution</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analyticsData.frequent_conditions} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                            <XAxis type="number" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <YAxis dataKey="disease" type="category" width={120} tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Bar dataKey="count" fill="#2D5A27" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-ink/50 py-10">Failed to load doctor analytics.</p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
