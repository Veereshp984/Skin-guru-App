import { ResultRow } from "../components/results/ResultRow";
import { formatProbability } from "../lib/format";

export function ResultsSection({
  sectionRef,
  prediction,
  topPrediction,
  previewUrl,
  isPredicting,
  isDownloadingReport,
  onDownloadReport,
  onOpenFilePicker,
}) {
  return (
    <section
      id="results"
      ref={sectionRef}
      className="scroll-mt-28 rounded-[40px] border border-white/70 bg-white/60 p-6 shadow-soft backdrop-blur-2xl sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sage">Result</p>
          <h2 className="mt-3 font-display text-4xl leading-none">Your assessment output</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {topPrediction ? (
            <>
              <div className="rounded-full bg-[#eef3ea] px-4 py-2 text-sm font-semibold text-sage">
                Confidence {formatProbability(topPrediction.probability)}
              </div>
              <button
                type="button"
                onClick={onDownloadReport}
                disabled={isDownloadingReport}
                className="rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-progress disabled:opacity-60"
              >
                {isDownloadingReport ? "Preparing PDF..." : "Download detailed PDF"}
              </button>
            </>
          ) : (
            <div className="rounded-full bg-white/80 px-4 py-2 text-sm text-ink/56">
              No result yet
            </div>
          )}
        </div>
      </div>

      {prediction ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
          <article className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,#223029_0%,#314238_100%)] p-6 text-white shadow-device">
            {/* Holographic glowing accent */}
            <div className="absolute right-0 top-0 h-32 w-32 bg-lime/20 blur-3xl rounded-full pointer-events-none" />

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.24em] text-white/52">Most likely match</p>
              {prediction.model_version && (
                <span className="text-[10px] uppercase bg-white/10 px-2.5 py-1 rounded-full text-white/80 font-mono">
                  v{prediction.model_version}
                </span>
              )}
            </div>

            {previewUrl ? (
              <div className="mt-4 overflow-hidden rounded-[24px]">
                <img src={previewUrl} alt="Lesion preview" className="h-56 w-full object-cover" />
              </div>
            ) : null}

            <h3 className="mt-5 font-display text-4xl leading-none sm:text-5xl">{topPrediction.name}</h3>
            
            <div className="mt-4 flex flex-wrap gap-2 items-center">
              <span className="inline-flex rounded-full border border-white/12 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
                {topPrediction.code}
              </span>
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-mono text-white/80">
                Model: {prediction.model?.toUpperCase()}
              </span>
            </div>

            <p className="mt-5 text-sm leading-7 text-white/78">{topPrediction.description}</p>
            
            {/* Report Metadata Details */}
            <div className="mt-6 border-t border-white/10 pt-5 space-y-3 text-[13px] text-white/60">
              <div className="flex justify-between items-center">
                <span>Report ID:</span>
                <span className="font-mono text-white select-all bg-white/5 px-2.5 py-1 rounded text-[11px] border border-white/5">
                  {prediction.report_id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Scan Time:</span>
                <span className="text-white">
                  {prediction.timestamp ? new Date(prediction.timestamp).toLocaleString() : new Date().toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Inference Time:</span>
                <span className="text-lime font-semibold">
                  {prediction.processing_time_ms ? `${prediction.processing_time_ms} ms` : "N/A"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onDownloadReport}
              disabled={isDownloadingReport}
              className="mt-6 w-full rounded-full bg-lime px-5 py-4 text-sm font-bold text-forest hover:shadow-[0_8px_24px_rgba(134,214,29,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDownloadingReport ? "Preparing report..." : "Download detailed PDF report"}
            </button>
          </article>

          <div className="grid gap-3">
            {prediction.predictions.map((entry, index) => (
              <ResultRow key={entry.code} entry={entry} index={index} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[28px] border border-dashed border-line bg-white/58 px-6 py-14 text-center">
          <p className="text-lg font-semibold text-ink">
            {isPredicting ? "Your image is being analyzed." : "No analysis yet"}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-ink/56">
            Upload an image in the section above and press `Get result` to see the top prediction
            and the ranked probability list here.
          </p>
          <button
            type="button"
            onClick={onOpenFilePicker}
            className="mt-6 rounded-full bg-lime px-6 py-4 text-sm font-semibold text-forest transition hover:-translate-y-0.5"
          >
            Upload image
          </button>
        </div>
      )}
    </section>
  );
}
