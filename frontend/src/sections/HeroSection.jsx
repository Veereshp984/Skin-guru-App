import { InfoTile } from "../components/shared/InfoTile";
import { ScannerUploadCard } from "../components/shared/ScannerUploadCard";
import { SITE_NAME } from "../constants/content";

export function HeroSection({
  infoTiles,
  imageFile,
  predictMessage,
  onOpenFilePicker,
  previewUrl,
  modelName,
  isDragging,
  isPredicting,
  onUploadKeyDown,
  onDragOver,
  onDragLeave,
  onDrop,
  onPredict,
  fileSizeLabel,
  isCameraActive,
  cameraStream,
  cameraError,
  onStartCamera,
  onCloseCamera,
  onCapturePhoto,
  onClearSelectedFile,
}) {
  return (
    <section
      id="upload"
      className="scroll-mt-32 grid gap-6 xl:min-h-[calc(100vh-8.75rem)] xl:grid-cols-[0.78fr_1.22fr]"
    >
      <div className="flex flex-col rounded-[44px] border border-white/70 bg-white/58 p-6 shadow-soft backdrop-blur-2xl sm:p-8 xl:h-full xl:min-h-[calc(100vh-8.75rem)]">
        <div>
          <div className="inline-flex rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.28em] text-sage">
            {SITE_NAME} AI Skin Check
          </div>
          <h1 className="mt-5 max-w-[10ch] font-display text-5xl leading-[0.88] sm:text-6xl 2xl:text-7xl">
            Stay on top of your skin health.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-ink/68 sm:text-lg 2xl:max-w-3xl">
            Upload a close, focused photo of the skin lesion, let the model analyze it, and
            review the ranked result in a clearer, more guided flow that uses the screen more
            intentionally.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onOpenFilePicker}
              className="rounded-full bg-lime px-6 py-4 text-sm font-semibold text-forest shadow-halo transition hover:-translate-y-0.5"
            >
              Check your skin
            </button>
            <a
              href="#results"
              className="rounded-full border border-white/70 bg-white/78 px-6 py-4 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-white"
            >
              Jump to results
            </a>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/70 bg-white/72 px-4 py-4 text-sm leading-7 text-ink/58">
            This scan is for informational screening support only and does not replace a medical diagnosis.
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {infoTiles.map((tile) => (
              <InfoTile key={tile.title} title={tile.title} text={tile.text} />
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[32px] bg-forest p-6 text-white shadow-device">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/48">
                Current selection
              </p>
              <p className="mt-3 text-lg font-semibold">
                {imageFile ? imageFile.name : "No file selected"}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/78">
              {imageFile ? "Ready" : "Waiting"}
            </span>
          </div>
          <p className="mt-4 text-sm leading-7 text-white/74">
            {imageFile ? `${fileSizeLabel} loaded for analysis.` : "Choose a clear lesion image to begin the scan."}
          </p>
          <p className="mt-3 text-sm leading-7 text-white/62">{predictMessage}</p>
        </div>
      </div>

      <ScannerUploadCard
        modelName={modelName}
        previewUrl={previewUrl}
        imageFile={imageFile}
        isDragging={isDragging}
        isPredicting={isPredicting}
        onOpenFilePicker={onOpenFilePicker}
        onUploadKeyDown={onUploadKeyDown}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onPredict={onPredict}
        isCameraActive={isCameraActive}
        cameraStream={cameraStream}
        cameraError={cameraError}
        onStartCamera={onStartCamera}
        onCloseCamera={onCloseCamera}
        onCapturePhoto={onCapturePhoto}
        onClearSelectedFile={onClearSelectedFile}
      />
    </section>
  );
}
