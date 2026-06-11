import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPredictionHistory, getPrediction } from "../lib/api";
import { generateAnalysisReport } from "../lib/report";
import { formatProbability } from "../lib/format";
import { TopNav } from "../components/layout/TopNav";
import { navItems } from "../constants/content";

export function ScanHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Detail view state
  const [expandedId, setExpandedId] = useState(null);
  const [detailedReport, setDetailedReport] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const limit = 10;

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      setError("");
      try {
        const skip = (page - 1) * limit;
        const data = await getPredictionHistory(skip, limit);
        setHistory(data);
        setHasMore(data.length === limit);
      } catch (err) {
        console.error(err);
        setError("Could not load scan history. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [page]);

  async function handleToggleExpand(reportId) {
    if (expandedId === reportId) {
      setExpandedId(null);
      setDetailedReport(null);
      return;
    }

    setExpandedId(reportId);
    setDetailedReport(null);
    setLoadingDetail(true);

    try {
      const detail = await getPrediction(reportId);
      setDetailedReport(detail);
    } catch (err) {
      console.error(err);
      setError("Could not load details for this report.");
      setExpandedId(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleDownloadPDF(e, report) {
    e.stopPropagation();
    setDownloadingId(report.report_id);
    try {
      let fullReport = detailedReport;
      if (!fullReport || fullReport.report_id !== report.report_id) {
        fullReport = await getPrediction(report.report_id);
      }

      // Adapt stored mongo data format to expected PDF builder format
      const pdfData = {
        model: fullReport.model_name,
        report_id: fullReport.report_id,
        top_prediction: {
          code: fullReport.predicted_code,
          name: fullReport.predicted_disease,
          probability: fullReport.confidence,
          description: fullReport.top_predictions?.[0]?.description || "Skin lesion match.",
        },
        predictions: fullReport.top_predictions.map((p, idx) => ({
          index: idx,
          code: p.code,
          name: p.name,
          probability: p.probability,
          description: p.description,
        })),
        model_version: fullReport.model_version || "1.0.0",
        processing_time_ms: fullReport.processing_time_ms || 0,
        timestamp: fullReport.created_at,
      };

      await generateAnalysisReport({
        prediction: pdfData,
        imageFile: null, // Image not persisted on server to save storage
        modelName: pdfData.model,
      });
    } catch (err) {
      console.error(err);
      alert("Error generating PDF report.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_30rem),radial-gradient(circle_at_85%_15%,rgba(134,214,29,0.18),transparent_18rem),radial-gradient(circle_at_18%_84%,rgba(82,113,87,0.14),transparent_22rem)]" />

        <div className="relative mx-auto max-w-[1280px] px-4 pb-16 pt-4 sm:px-6 lg:px-8">
          <TopNav navItems={navItems} />

          <header className="mt-8">
            <p className="text-xs uppercase tracking-[0.3em] text-sage">Records</p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl leading-none">Your Scan History</h1>
            <p className="mt-4 text-base leading-7 text-ink/64 max-w-xl">
              Access and review all your past AI-assisted skin checks, confidence details, and download comprehensive assessment reports.
            </p>
          </header>

          <main className="mt-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-lime/30 border-t-lime" />
                <p className="mt-4 text-sm text-sage">Retrieving history...</p>
              </div>
            ) : error ? (
              <div className="rounded-[32px] border border-rose-100 bg-rose-50/50 p-6 text-center text-rose-700">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setPage(page)}
                  className="mt-4 rounded-full bg-rose-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                >
                  Retry
                </button>
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-[44px] border border-dashed border-line bg-white/50 px-6 py-20 text-center backdrop-blur-md">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-3xl">
                  📜
                </div>
                <h3 className="mt-5 text-xl font-semibold">No scans recorded</h3>
                <p className="mt-3 text-sm text-ink/56 max-w-sm mx-auto">
                  You haven't run any AI skin checks yet. Start a new assessment to see your records here.
                </p>
                <Link
                  to="/app"
                  className="mt-6 inline-flex rounded-full bg-lime px-6 py-3.5 text-sm font-semibold text-forest shadow-halo transition hover:-translate-y-0.5"
                >
                  Analyze Skin Now
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* History List */}
                <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/50 shadow-soft backdrop-blur-md">
                  <div className="divide-y divide-line">
                    {history.map((record) => {
                      const isExpanded = expandedId === record.report_id;
                      return (
                        <div
                          key={record.report_id}
                          className={`transition ${isExpanded ? "bg-stone-50/40" : "hover:bg-white/30"}`}
                        >
                          {/* Row Header */}
                          <div
                            onClick={() => handleToggleExpand(record.report_id)}
                            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-semibold text-ink truncate">
                                  {record.predicted_disease}
                                </h4>
                                <span className="rounded bg-white border border-line px-1.5 py-0.5 text-[10px] font-mono uppercase text-sage">
                                  {record.predicted_code}
                                </span>
                              </div>
                              <p className="mt-1.5 text-xs text-ink/48">
                                {new Date(record.created_at).toLocaleString()} • Model:{" "}
                                <span className="uppercase">{record.model_name}</span>
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                              <div className="text-right">
                                <p className="text-xs uppercase tracking-wider text-sage font-semibold">
                                  Confidence
                                </p>
                                <p className="text-base font-bold text-ink">
                                  {formatProbability(record.confidence)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => handleDownloadPDF(e, record)}
                                  disabled={downloadingId === record.report_id}
                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink/70 hover:bg-lime hover:text-forest transition hover:scale-105"
                                  title="Download Report"
                                >
                                  {downloadingId === record.report_id ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest/30 border-t-forest" />
                                  ) : (
                                    <svg
                                      className="h-4.5 w-4.5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12"
                                      />
                                    </svg>
                                  )}
                                </button>
                                <svg
                                  className={`h-5 w-5 text-sage transition-transform duration-300 ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Detail Panel */}
                          {isExpanded && (
                            <div className="border-t border-line bg-[#fcfdfb]/60 px-5 py-6">
                              {loadingDetail ? (
                                <div className="flex items-center justify-center py-6">
                                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-lime/30 border-t-lime" />
                                  <span className="ml-3 text-xs text-sage">Loading assessment profile...</span>
                                </div>
                              ) : detailedReport ? (
                                <div className="grid gap-6 md:grid-cols-2">
                                  {/* Diagnosis details */}
                                  <div>
                                    <h5 className="text-xs uppercase tracking-widest text-sage font-bold">
                                      Diagnosis Summary
                                    </h5>
                                    <p className="mt-3 text-xl font-bold text-ink">
                                      {detailedReport.predicted_disease}
                                    </p>
                                    <p className="mt-2 text-sm text-ink/70 leading-6">
                                      {detailedReport.top_predictions?.[0]?.description ||
                                        "No description recorded for this lesion model output."}
                                    </p>

                                    <div className="mt-5 space-y-2 text-xs text-ink/50 border-t border-line pt-4">
                                      <p>
                                        Report ID:{" "}
                                        <span className="font-mono text-ink/80 select-all">
                                          {detailedReport.report_id}
                                        </span>
                                      </p>
                                      <p>Model version: {detailedReport.model_version}</p>
                                      <p>
                                        Processing time:{" "}
                                        {detailedReport.processing_time_ms
                                          ? `${detailedReport.processing_time_ms} ms`
                                          : "N/A"}
                                      </p>
                                      <p>Image File: {detailedReport.image_filename || "N/A"}</p>
                                    </div>
                                  </div>

                                  {/* List of other matches */}
                                  <div>
                                    <h5 className="text-xs uppercase tracking-widest text-sage font-bold mb-3">
                                      Differential Predictions
                                    </h5>
                                    <div className="space-y-2">
                                      {detailedReport.top_predictions?.map((item, index) => (
                                        <div
                                          key={item.code}
                                          className="flex items-center justify-between rounded-xl bg-white/70 border border-line p-3"
                                        >
                                          <div className="min-w-0">
                                            <span className="text-xs font-semibold text-ink block truncate">
                                              {item.name}
                                            </span>
                                            <span className="text-[10px] text-sage font-mono uppercase">
                                              {item.code}
                                            </span>
                                          </div>
                                          <div className="text-right">
                                            <span className="text-xs font-bold text-ink">
                                              {formatProbability(item.probability)}
                                            </span>
                                            {/* Small visual bar */}
                                            <div className="h-1 w-12 bg-stone-200 rounded-full mt-1 overflow-hidden">
                                              <div
                                                className={`h-full ${
                                                  index === 0
                                                    ? "bg-lime"
                                                    : index === 1
                                                    ? "bg-sage"
                                                    : "bg-blush"
                                                }`}
                                                style={{ width: `${item.probability * 100}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-rose-500">Failed to load detailed report.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-6 px-4">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="rounded-full border border-line bg-white/80 px-4 py-2 text-xs font-semibold text-ink transition hover:bg-lime hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/80 disabled:hover:text-ink/60"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-sage font-semibold">
                    Page {page}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => (hasMore ? p + 1 : p))}
                    disabled={!hasMore}
                    className="rounded-full border border-line bg-white/80 px-4 py-2 text-xs font-semibold text-ink transition hover:bg-lime hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/80 disabled:hover:text-ink/60"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
