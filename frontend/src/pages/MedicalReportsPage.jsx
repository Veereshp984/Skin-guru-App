import { useEffect, useState } from "react";
import { getReports, archiveReport, deleteReport, getReportImageUrl } from "../lib/api";
import { formatProbability } from "../lib/format";
import { TopNav } from "../components/layout/TopNav";
import { navItems } from "../constants/content";
import { useAuth } from "../auth/AuthContext";
import { ReportDetailsModal } from "../components/shared/ReportDetailsModal";

// Helper component to render secure image in lists
function SecureImageThumbnail({ reportId }) {
  const [url, setUrl] = useState("");

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

  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-stone-100 border border-line flex items-center justify-center">
      {url ? (
        <img src={url} alt="Lesion thumbnail" className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm">📸</span>
      )}
    </div>
  );
}

export function MedicalReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("card"); // "card" or "table"

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [diseaseFilter, setDiseaseFilter] = useState("");
  const [minConfidence, setMinConfidence] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;

  // Selected report for detail modal
  const [selectedReportId, setSelectedReportId] = useState(null);

  // Fetch reports on filter change
  useEffect(() => {
    async function fetchList() {
      setLoading(true);
      setError("");
      try {
        const skip = (page - 1) * limit;
        const data = await getReports({
          q: searchQuery,
          status: statusFilter,
          disease: diseaseFilter,
          min_confidence: minConfidence ? parseFloat(minConfidence) / 100 : undefined,
          start_date: startDate ? new Date(startDate).toISOString() : undefined,
          end_date: endDate ? new Date(endDate).toISOString() : undefined,
          sort_by: sortBy,
          skip,
          limit,
        });
        setReports(data);
        setHasMore(data.length === limit);
      } catch (err) {
        console.error(err);
        setError("Failed to load medical reports. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    
    // Simple debounce/delay for search inputs
    const timer = setTimeout(() => {
      fetchList();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, diseaseFilter, minConfidence, startDate, endDate, sortBy, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, diseaseFilter, minConfidence, startDate, endDate, sortBy]);

  async function handleArchive(reportId) {
    if (!confirm("Are you sure you want to archive this medical report?")) {
      return;
    }
    try {
      await archiveReport(reportId, true);
      setReports((prev) => prev.filter((r) => r.report_id !== reportId));
    } catch (err) {
      alert("Error archiving report: " + err.message);
    }
  }

  async function handleDelete(reportId) {
    if (!confirm("WARNING: Are you sure you want to permanently delete this report from the system? This cannot be undone.")) {
      return;
    }
    try {
      await deleteReport(reportId);
      setReports((prev) => prev.filter((r) => r.report_id !== reportId));
    } catch (err) {
      alert("Error deleting report: " + err.message);
    }
  }

  // Update modal contents in list if revised by doctor
  function handleReportUpdated(updatedReport) {
    setReports((prev) =>
      prev.map((r) => (r.report_id === updatedReport.report_id ? updatedReport : r))
    );
  }

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="relative overflow-hidden">
        {/* Holographic glowing backgrounds */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_30rem),radial-gradient(circle_at_85%_15%,rgba(134,214,29,0.18),transparent_18rem),radial-gradient(circle_at_18%_84%,rgba(82,113,87,0.14),transparent_22rem)]" />

        <div className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-4 sm:px-6 lg:px-8">
          <TopNav navItems={navItems} />

          {/* Heading */}
          <header className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sage font-bold">Medical Database</p>
              <h1 className="mt-2 font-display text-4xl sm:text-5xl leading-none">Clinical Reports Manager</h1>
              <p className="mt-3 text-sm text-ink/60 max-w-xl">
                {user?.role === "patient"
                  ? "Access, search, and download your history of AI skin checks and attending doctor consultations."
                  : "Database management system for clinical records, patient scans, and diagnostic sign-offs."}
              </p>
            </div>

            {/* Layout Toggle */}
            <div className="flex gap-2 rounded-xl bg-stone-200/50 p-1 self-start sm:self-end">
              <button
                type="button"
                onClick={() => setViewMode("card")}
                className={`p-2 rounded-lg transition ${
                  viewMode === "card" ? "bg-white shadow-sm text-ink" : "text-ink/60 hover:text-ink"
                }`}
                title="Card Grid view"
              >
                🎴 Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition ${
                  viewMode === "table" ? "bg-white shadow-sm text-ink" : "text-ink/60 hover:text-ink"
                }`}
                title="Table view"
              >
                📋 List
              </button>
            </div>
          </header>

          {/* Filter Toolbar */}
          <section className="mt-8 rounded-3xl border border-white/60 bg-white/40 p-5 shadow-soft backdrop-blur-md">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {/* Search */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-ink/70 mb-1">Search reports</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Report ID or disease name..."
                  className="w-full rounded-xl border border-line bg-white/80 p-2.5 text-sm text-ink focus:border-lime focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Review status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white/80 p-2.5 text-sm text-ink focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="requires_consultation">Consultation Required</option>
                </select>
              </div>

              {/* Confidence filter */}
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Min confidence (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(e.target.value)}
                  placeholder="e.g. 80"
                  className="w-full rounded-xl border border-line bg-white/80 p-2.5 text-sm text-ink focus:outline-none"
                />
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Sort order</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white/80 p-2.5 text-sm text-ink focus:outline-none"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="confidence">Highest confidence</option>
                </select>
              </div>

              {/* Disease filter */}
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Disease filter</label>
                <input
                  type="text"
                  value={diseaseFilter}
                  onChange={(e) => setDiseaseFilter(e.target.value)}
                  placeholder="e.g. Melanoma"
                  className="w-full rounded-xl border border-line bg-white/80 p-2.5 text-sm text-ink focus:outline-none"
                />
              </div>
            </div>

            {/* Date picking row */}
            <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-4 text-xs font-semibold text-ink/70">
              <div className="flex items-center gap-2">
                <span>From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-line bg-white/80 p-1.5 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span>To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-line bg-white/80 p-1.5 focus:outline-none"
                />
              </div>
              {(startDate || endDate || searchQuery || statusFilter || minConfidence || diseaseFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("");
                    setMinConfidence("");
                    setStartDate("");
                    setEndDate("");
                    setDiseaseFilter("");
                  }}
                  className="ml-auto text-rose-600 hover:text-rose-700 transition"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </section>

          {/* Database Output */}
          <main className="mt-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-lime/30 border-t-lime" />
                <p className="mt-4 text-sm text-sage">Scanning report records...</p>
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-6 text-center text-rose-700">
                <p>{error}</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="rounded-[40px] border border-dashed border-line bg-white/50 px-6 py-20 text-center backdrop-blur-md">
                <span className="text-4xl block">🔍</span>
                <h3 className="mt-4 text-lg font-semibold text-ink">No reports found</h3>
                <p className="mt-2 text-sm text-ink/50 max-w-sm mx-auto">
                  Try adjusting your filter search queries or run a new AI skin scanner check.
                </p>
              </div>
            ) : viewMode === "card" ? (
              /* Card Layout Grid */
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {reports.map((report) => (
                  <article
                    key={report.report_id}
                    onClick={() => setSelectedReportId(report.report_id)}
                    className="flex flex-col justify-between rounded-3xl border border-white/60 bg-white/50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md cursor-pointer hover:bg-white/80"
                  >
                    <div>
                      {/* Image & Header */}
                      <div className="flex items-center gap-3">
                        <SecureImageThumbnail reportId={report.report_id} />
                        <div className="min-w-0">
                          <h4 className="font-semibold text-ink truncate">{report.predicted_disease}</h4>
                          <span className="inline-block rounded bg-stone-100 border border-line px-1.5 py-0.2 text-[9px] font-mono uppercase text-sage">
                            {report.predicted_code}
                          </span>
                        </div>
                      </div>

                      {/* Primary Stats */}
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 text-xs">
                        <div>
                          <p className="text-ink/40 uppercase font-semibold text-[9px]">Confidence</p>
                          <p className="text-sm font-bold text-ink">{formatProbability(report.confidence)}</p>
                        </div>
                        <div>
                          <p className="text-ink/40 uppercase font-semibold text-[9px]">Scan Time</p>
                          <p className="text-sm text-ink truncate">{new Date(report.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4">
                      {/* Status pill */}
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        report.doctor_review_status === "reviewed"
                          ? "bg-forest/10 text-forest"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {report.doctor_review_status.replace(/_/g, " ")}
                      </span>

                      {/* Delete actions */}
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleArchive(report.report_id)}
                          className="p-1.5 text-xs rounded-full border border-line bg-white text-ink/60 hover:bg-stone-50 transition"
                          title="Archive report"
                        >
                          📦
                        </button>
                        {user?.role === "admin" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(report.report_id)}
                            className="p-1.5 text-xs rounded-full border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                            title="Hard delete report"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              /* Table Layout */
              <div className="overflow-x-auto rounded-3xl border border-white/60 bg-white/50 shadow-sm backdrop-blur-md">
                <table className="w-full border-collapse text-left text-sm text-ink">
                  <thead className="bg-stone-100 border-b border-line text-xs uppercase tracking-wider text-sage font-bold">
                    <tr>
                      <th className="p-4">Lesion</th>
                      <th className="p-4">Predicted Match</th>
                      <th className="p-4">Confidence</th>
                      <th className="p-4">Scan Date</th>
                      <th className="p-4">Review Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-white/20">
                    {reports.map((report) => (
                      <tr
                        key={report.report_id}
                        onClick={() => setSelectedReportId(report.report_id)}
                        className="hover:bg-white/40 transition cursor-pointer"
                      >
                        <td className="p-4">
                          <SecureImageThumbnail reportId={report.report_id} />
                        </td>
                        <td className="p-4 font-semibold">
                          <div>
                            <span>{report.predicted_disease}</span>
                            <span className="ml-2 inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-mono text-sage uppercase">
                              {report.predicted_code}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-ink">
                          {formatProbability(report.confidence)}
                        </td>
                        <td className="p-4 text-ink/70">
                          {new Date(report.created_at).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            report.doctor_review_status === "reviewed"
                              ? "bg-forest/10 text-forest"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {report.doctor_review_status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => handleArchive(report.report_id)}
                              className="px-3 py-1 text-xs rounded-lg border border-line bg-white hover:bg-stone-50 transition"
                            >
                              Archive
                            </button>
                            {user?.role === "admin" && (
                              <button
                                type="button"
                                onClick={() => handleDelete(report.report_id)}
                                className="px-3 py-1 text-xs rounded-lg border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination controls */}
            {reports.length > 0 && (
              <div className="flex items-center justify-between mt-6 px-4">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="rounded-full border border-line bg-white/80 px-4 py-2 text-xs font-semibold text-ink transition hover:bg-lime hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed"
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
                  className="rounded-full border border-line bg-white/80 px-4 py-2 text-xs font-semibold text-ink transition hover:bg-lime hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Details Dialog overlay */}
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
