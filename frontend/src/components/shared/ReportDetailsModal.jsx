import { useEffect, useState } from "react";
import { getReportImageUrl, submitDoctorReview, getAccessToken, API_BASE, requestReview, getPatientReviews, getDoctorsList } from "../../lib/api";
import { formatProbability } from "../../lib/format";
import { useAuth } from "../../auth/AuthContext";

export function ReportDetailsModal({ reportId, onClose, onUpdate }) {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Doctor review form state
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState("reviewed");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Patient consultation review states
  const [review, setReview] = useState(null);
  const [doctorsList, setDoctorsList] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [requestingReview, setRequestingReview] = useState(false);
  const [reviewRequestError, setReviewRequestError] = useState("");

  const isDoctorOrAdmin = user && (user.role === "doctor" || user.role === "admin");

  // Fetch report details on mount
  useEffect(() => {
    let active = true;
    async function loadDetails() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/api/reports/${reportId}`, {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        });
        if (!response.ok) {
          throw new Error("Could not retrieve medical report details.");
        }
        const data = await response.json();
        if (active) {
          setReport(data);
          // Set initial review state if doctor has already reviewed
          if (data.doctor_review) {
            setComments(data.doctor_review.comments || "");
            setStatus(data.doctor_review.status || "reviewed");
          }
        }

        // Fetch secure image object URL
        const objectUrl = await getReportImageUrl(reportId);
        if (active && objectUrl) {
          setImageUrl(objectUrl);
        }

        // Fetch review details and list of doctors
        if (user) {
          try {
            let matchingReview = null;
            if (user.role === "patient") {
              const patientReviews = await getPatientReviews();
              matchingReview = patientReviews.find((r) => r.report_id === reportId);
              const docs = await getDoctorsList();
              if (active) {
                setDoctorsList(docs);
              }
            } else if (user.role === "doctor") {
              // Fetch assigned doctor reviews
              const responseReview = await fetch(`${API_BASE}/api/reviews/doctor`, {
                headers: {
                  Authorization: `Bearer ${getAccessToken()}`,
                },
              });
              if (responseReview.ok) {
                const docReviews = await responseReview.json();
                matchingReview = docReviews.find((r) => r.report_id === reportId);
              }
            }
            if (active && matchingReview) {
              setReview(matchingReview);
            }
          } catch (rErr) {
            console.error("Error loading review/doctor records:", rErr);
          }
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load report details.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      active = false;
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [reportId]);

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!comments.trim()) {
      setReviewError("Review comments cannot be empty.");
      return;
    }

    setSubmittingReview(true);
    setReviewError("");

    try {
      const updated = await submitDoctorReview(reportId, comments, status);
      setReport(updated);
      if (onUpdate) {
        onUpdate(updated);
      }
    } catch (err) {
      setReviewError(err.message || "Failed to submit clinical review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleRequestReview(e) {
    e.preventDefault();
    setRequestingReview(true);
    setReviewRequestError("");
    try {
      const newReview = await requestReview(reportId, selectedDoctorId || null);
      setReview(newReview);
      setReport((prev) => ({
        ...prev,
        doctor_review_status: "pending"
      }));
      if (onUpdate) {
        onUpdate({
          ...report,
          doctor_review_status: "pending"
        });
      }
    } catch (err) {
      setReviewRequestError(err.message || "Failed to request review.");
    } finally {
      setRequestingReview(false);
    }
  }

  const downloadUrl = `${API_BASE}/api/reports/download/${reportId}?token=${getAccessToken()}`;

  // Handle protected download click by fetching manually to preserve token header
  async function handleDownloadPDF() {
    const isCapacitor = !!window.Capacitor;
    if (isCapacitor) {
      window.open(downloadUrl, "_system");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/reports/download/${reportId}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to download report PDF.");
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Medical_Report_${report?.predicted_disease.replace(/\s+/g, "_") || reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(err.message || "Error exporting PDF.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      {/* Modal Card */}
      <article className="relative z-10 flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[36px] border border-white/80 bg-[#fbfcf7]/96 shadow-[0_32px_64px_rgba(31,39,35,0.22)] backdrop-blur-2xl animate-scale-up">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-line p-5 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-sage">Assessment Report</p>
            <h3 className="mt-1.5 font-display text-xl sm:text-2xl text-ink">
              {loading ? "Loading assessment details..." : report?.predicted_disease}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-200/60 text-ink/70 hover:bg-stone-200 hover:text-ink transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-lime/30 border-t-lime" />
              <p className="mt-4 text-sm text-sage">Retrieving clinical profile...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 text-center text-rose-700">
              <p className="font-medium">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-full bg-rose-600 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-rose-700"
              >
                Close Report
              </button>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              {/* Left Column: Image & AI Metrics */}
              <div className="space-y-6">
                {/* Image & Main stats */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="relative aspect-video sm:aspect-square overflow-hidden rounded-3xl bg-stone-100 border border-line flex items-center justify-center">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Skin lesion" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center p-4">
                        <span className="text-4xl">📸</span>
                        <p className="mt-2 text-xs text-ink/40">Secure image not available</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-between rounded-3xl bg-forest p-5 text-white">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">Primary AI Output</p>
                      <h4 className="mt-3 font-display text-2xl sm:text-3xl leading-tight">{report.predicted_disease}</h4>
                      <span className="mt-2 inline-block rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono uppercase text-lime">
                        {report.predicted_code}
                      </span>
                    </div>

                    <div className="mt-6 border-t border-white/10 pt-4">
                      <p className="text-[10px] uppercase tracking-wider text-white/40">Match Confidence</p>
                      <p className="text-3xl font-extrabold mt-1 text-lime">
                        {formatProbability(report.confidence)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Differential Diagnosis (Top predictions) */}
                <div className="rounded-3xl border border-white/60 bg-white/40 p-5 backdrop-blur-md">
                  <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-sage">Differential Diagnoses</h4>
                  <div className="mt-4 space-y-3">
                    {report.top_predictions.map((entry, index) => (
                      <div key={entry.code} className="flex flex-col gap-2 rounded-2xl border border-line bg-white/70 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-sage">
                              {index + 1}
                            </span>
                            <span className="text-sm font-semibold text-ink">{entry.name}</span>
                          </div>
                          <span className="text-sm font-bold text-ink">{formatProbability(entry.probability)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-stone-200/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              index === 0 ? "bg-lime" : index === 1 ? "bg-sage" : "bg-blush"
                            }`}
                            style={{ width: `${entry.probability * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-ink/50 leading-relaxed mt-1 pl-8">
                          {entry.code.toUpperCase()} — {entry.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Metadata & Clinical Review */}
              <div className="space-y-6">
                {/* Metadata block */}
                <div className="rounded-3xl border border-white/60 bg-white/40 p-5 backdrop-blur-md">
                  <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-sage">Report Specifications</h4>
                  <div className="mt-4 divide-y divide-line text-sm">
                    <div className="flex justify-between py-2.5">
                      <span className="text-ink/50">Report ID</span>
                      <span className="font-mono text-xs text-ink select-all">{report.report_id}</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-ink/50">Timestamp</span>
                      <span className="text-ink">{new Date(report.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-ink/50">Processing Time</span>
                      <span className="text-ink font-semibold text-forest">{report.processing_time_ms} ms</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-ink/50">Analysis Model</span>
                      <span className="text-ink uppercase">{report.model_name} (v{report.model_version})</span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-ink/50">Attending Status</span>
                      <span className={`font-semibold capitalize ${
                        report.doctor_review_status === "reviewed" ? "text-forest" : "text-amber-600"
                      }`}>
                        {report.doctor_review_status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attending Review */}
                <div className="rounded-3xl border border-white/60 bg-white/40 p-5 backdrop-blur-md">
                  <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-sage">Clinical Sign-Off</h4>
                  {report.doctor_review ? (
                    <div className="mt-4 rounded-2xl bg-forest/5 border border-forest/10 p-4 animate-scale-up">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🩺</span>
                        <div>
                          <p className="text-sm font-bold text-ink">{report.doctor_review.doctor_name}</p>
                          <p className="text-[10px] text-sage">{report.doctor_review.doctor_email}</p>
                        </div>
                      </div>
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="text-xs text-sage font-semibold uppercase tracking-wider">Comments & Recommendations</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink/84 whitespace-pre-wrap">{report.doctor_review.comments}</p>
                      </div>
                      <div className="mt-3 text-[10px] text-ink/40 text-right">
                        Reviewed at: {new Date(report.doctor_review.reviewed_at).toLocaleString()}
                      </div>
                    </div>
                  ) : user && user.role === "patient" ? (
                    /* Patient Review Request Panel */
                    <div className="mt-4">
                      {review ? (
                        /* Tracker & Timeline */
                        <div className="space-y-4 rounded-2xl bg-foam p-4 border border-line animate-scale-up">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-sage uppercase font-bold">Review Status</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              review.status === "accepted" ? "bg-mint/40 text-forest" :
                              review.status === "rejected" ? "bg-blush/20 text-blush" :
                              "bg-amber-100 text-amber-800"
                            }`}>
                              {review.status.replace(/_/g, " ")}
                            </span>
                          </div>

                          {/* Timeline */}
                          <div className="relative pl-6 border-l-2 border-line space-y-4 text-xs mt-3">
                            <div className="relative">
                              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-forest text-[8px] text-white">✓</span>
                              <p className="font-bold text-ink">AI scan completed</p>
                              <p className="text-[10px] text-sage">{new Date(report.created_at).toLocaleString()}</p>
                            </div>
                            <div className="relative">
                              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-forest text-[8px] text-white">✓</span>
                              <p className="font-bold text-ink">Clinical review requested</p>
                              <p className="text-[10px] text-sage">{new Date(review.created_at).toLocaleString()}</p>
                            </div>
                            <div className="relative">
                              <span className={`absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] text-white ${
                                ["accepted", "reviewed", "requires_further_examination"].includes(review.status) ? "bg-forest" : "bg-stone-300"
                              }`}>
                                {["accepted", "reviewed", "requires_further_examination"].includes(review.status) ? "✓" : "•"}
                              </span>
                              <p className={`font-bold ${["accepted", "reviewed", "requires_further_examination"].includes(review.status) ? "text-ink" : "text-ink/40"}`}>
                                Doctor claimed case
                              </p>
                              {review.doctor_name && (
                                <p className="text-[10px] text-sage">Attending: Dr. {review.doctor_name}</p>
                              )}
                            </div>
                            <div className="relative">
                              <span className={`absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] text-white ${
                                ["reviewed", "requires_further_examination"].includes(review.status) ? "bg-forest" : "bg-stone-300"
                              }`}>
                                {["reviewed", "requires_further_examination"].includes(review.status) ? "✓" : "•"}
                              </span>
                              <p className={`font-bold ${["reviewed", "requires_further_examination"].includes(review.status) ? "text-ink" : "text-ink/40"}`}>
                                Diagnosis finalized
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Request Review Form */
                        <form onSubmit={handleRequestReview} className="space-y-4 rounded-2xl bg-stone-50/50 p-4 border border-dashed border-line animate-scale-up">
                          <p className="text-xs text-sage leading-relaxed">
                            Need clinical feedback? Submit this scan to our medical panel. Any available dermatologist can claim and review your case, or you can select a preferred consultant below.
                          </p>

                          <div>
                            <label className="block text-[10px] font-semibold text-ink/70 mb-1 uppercase tracking-wider">Preferred Doctor (Optional)</label>
                            <select
                              value={selectedDoctorId}
                              onChange={(e) => setSelectedDoctorId(e.target.value)}
                              className="w-full rounded-xl border border-line bg-white p-2 text-xs text-ink focus:outline-none"
                            >
                              <option value="">Any Available Dermatologist (Recommended)</option>
                              {doctorsList.map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  Dr. {doc.full_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="submit"
                            disabled={requestingReview}
                            className="w-full rounded-xl bg-forest px-4 py-2.5 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                          >
                            {requestingReview ? "Requesting..." : "✉ Request Attending Review"}
                          </button>

                          {reviewRequestError && (
                            <p className="text-[10px] text-rose-500 mt-1">{reviewRequestError}</p>
                          )}
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 text-center py-6 text-sm text-ink/50">
                      <p>No clinical sign-off has been issued for this report yet.</p>
                      <p className="text-xs mt-1">Attending review is pending.</p>
                    </div>
                  )}
                </div>

                {/* Doctor/Admin Form Panel */}
                {isDoctorOrAdmin && (
                  <form onSubmit={handleReviewSubmit} className="rounded-3xl border border-white/60 bg-white/60 p-5 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-sage">Attending Doctor Review Panel</h4>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-ink/70 mb-1">Clinical Evaluation Remarks</label>
                        <textarea
                          rows="3"
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          placeholder="Provide diagnostic recommendations, skin care guidelines, and follow-up warnings..."
                          className="w-full rounded-2xl border border-line bg-white p-3 text-sm text-ink focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-ink/70 mb-1">Review Status</label>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full rounded-xl border border-line bg-white p-2.5 text-xs text-ink focus:border-lime focus:outline-none"
                          >
                            <option value="reviewed">Reviewed</option>
                            <option value="requires_consultation">Requires Consultation</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="submit"
                            disabled={submittingReview}
                            className="w-full rounded-xl bg-lime p-2.5 text-xs font-bold text-forest hover:shadow-md transition disabled:opacity-50"
                          >
                            {submittingReview ? "Saving..." : "Submit Review"}
                          </button>
                        </div>
                      </div>
                      {reviewError && <p className="text-xs text-rose-500">{reviewError}</p>}
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!loading && !error && report && (
          <footer className="flex shrink-0 items-center justify-between border-t border-line bg-stone-50/50 p-5 sm:px-8">
            <p className="text-xs text-ink/40">Report ID: {report.report_id.slice(0, 18)}...</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-stone-50 hover:scale-105 active:scale-95"
              >
                <span>📥</span> Export PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              >
                <span>🖨️</span> Print Report
              </button>
            </div>
          </footer>
        )}
      </article>
    </div>
  );
}
