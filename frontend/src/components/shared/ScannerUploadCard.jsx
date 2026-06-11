import { useEffect, useRef, useState } from "react";

function ScanCorner({ className }) {
  return (
    <div
      className={`pointer-events-none absolute h-11 w-11 border-l-[5px] border-t-[5px] border-white/80 ${className}`}
    />
  );
}

export function ScannerUploadCard({
  modelName,
  previewUrl,
  imageFile,
  isDragging,
  isPredicting,
  onOpenFilePicker,
  onUploadKeyDown,
  onDragOver,
  onDragLeave,
  onDrop,
  onPredict,
  isCameraActive,
  cameraStream,
  cameraError,
  onStartCamera,
  onCloseCamera,
  onCapturePhoto,
  onClearSelectedFile,
}) {
  const [activeTab, setActiveTab] = useState("upload"); // "upload" or "camera"
  const videoRef = useRef(null);

  // Set video source when stream is active
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Clean up camera when switching to upload tab
  useEffect(() => {
    if (activeTab === "upload" && isCameraActive) {
      onCloseCamera();
    }
  }, [activeTab, isCameraActive, onCloseCamera]);

  return (
    <article className="flex min-h-[500px] flex-col overflow-hidden rounded-[44px] border border-white/80 bg-[#fbfcf7]/92 p-5 shadow-device backdrop-blur-xl xl:h-full xl:min-h-[calc(100vh-8.75rem)]">
      {/* Top bar simulating a device header */}
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span>9:41</span>
        <div className="h-5 w-14 rounded-full bg-stone-200/85" />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-sage">AI skin scanner</p>
          <p className="mt-2 text-xl font-semibold text-ink sm:text-2xl">Capture or upload</p>
        </div>
        <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sage shadow-halo">
          {modelName}
        </span>
      </div>

      {/* Tabs */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-stone-200/50 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition ${
            activeTab === "upload"
              ? "bg-white text-ink shadow-sm"
              : "text-ink/60 hover:text-ink hover:bg-white/30"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Upload file
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("camera");
            onStartCamera();
          }}
          className={`flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition ${
            activeTab === "camera"
              ? "bg-white text-ink shadow-sm"
              : "text-ink/60 hover:text-ink hover:bg-white/30"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Take photo
        </button>
      </div>

      {/* Main Area */}
      <div
        role="button"
        tabIndex={0}
        onClick={activeTab === "upload" && !previewUrl ? onOpenFilePicker : undefined}
        onKeyDown={activeTab === "upload" && !previewUrl ? onUploadKeyDown : undefined}
        onDragOver={activeTab === "upload" ? onDragOver : undefined}
        onDragLeave={activeTab === "upload" ? onDragLeave : undefined}
        onDrop={activeTab === "upload" ? onDrop : undefined}
        className={`mt-4 flex flex-1 flex-col rounded-[36px] bg-[linear-gradient(180deg,#f8faf5_0%,#e7efe5_100%)] p-4 transition ${
          isDragging ? "ring-2 ring-lime/70 ring-offset-4 ring-offset-foam" : ""
        }`}
      >
        <div className="relative flex min-h-[280px] flex-1 items-center justify-center overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_50%_35%,rgba(134,214,29,0.28),transparent_32%),linear-gradient(180deg,#f7f8f4_0%,#ebefe6_100%)] p-5 shadow-halo sm:min-h-[340px] xl:min-h-0 xl:p-6">
          
          {/* Preview State */}
          {previewUrl ? (
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[28px] bg-[#d7dfd3]">
              <img
                src={previewUrl}
                alt="Selected skin lesion"
                className="h-full max-h-[28rem] w-full rounded-[24px] object-contain sm:max-h-[32rem]"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearSelectedFile();
                }}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 hover:scale-105"
                title="Remove photo"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ) : activeTab === "camera" ? (
            /* Live Camera State */
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-black">
              {isCameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-4">
                    <button
                      type="button"
                      onClick={() => onCapturePhoto(videoRef.current)}
                      className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-lime shadow-lg hover:scale-105 transition active:scale-95"
                      title="Capture photo"
                    >
                      <div className="h-6 w-6 rounded-full bg-forest" />
                    </button>
                    <button
                      type="button"
                      onClick={onCloseCamera}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                      title="Cancel camera"
                    >
                      <svg
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  {/* Laser Scanning Animation Overlay */}
                  <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-lime/80 shadow-[0_0_12px_#86d61d] animate-scan" />
                </>
              ) : (
                <div className="px-8 text-center text-white">
                  {cameraError ? (
                    <p className="text-sm text-rose-400">{cameraError}</p>
                  ) : (
                    <p className="text-sm text-stone-400">Camera initialization...</p>
                  )}
                  <button
                    type="button"
                    onClick={onStartCamera}
                    className="mt-4 rounded-full bg-lime px-6 py-2 text-xs font-semibold uppercase tracking-wider text-forest transition hover:-translate-y-0.5"
                  >
                    Retry camera
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Upload File Placeholder State */
            <div className="px-8 text-center">
              <div className="mx-auto flex h-28 w-24 items-center justify-center rounded-[28px] bg-[linear-gradient(180deg,#9cd365_0%,#7abd47_48%,#f8faf5_48%,#f8faf5_100%)] shadow-[0_24px_40px_rgba(92,130,78,0.22)]">
                <div className="h-16 w-12 rounded-[18px] bg-white/16" />
              </div>
              <p className="mt-5 text-sm leading-6 text-ink/62">
                Drag an image here or tap to browse from your device.
              </p>
            </div>
          )}

          {/* Holographic scanner border lines */}
          <div className="pointer-events-none absolute inset-11 rounded-[28px] border border-white/80" />
          <ScanCorner className="left-12 top-12" />
          <ScanCorner className="right-12 top-12 rotate-90" />
          <ScanCorner className="bottom-12 left-12 -rotate-90" />
          <ScanCorner className="bottom-12 right-12 rotate-180" />
          {!previewUrl && activeTab === "upload" ? (
            <div className="pointer-events-none absolute left-14 right-14 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_26px_rgba(255,255,255,0.95)] animate-scan" />
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={onPredict}
          disabled={isPredicting || !imageFile}
          className="inline-flex min-h-14 w-full max-w-[320px] items-center justify-center rounded-full bg-lime px-8 py-4 text-base font-semibold text-forest shadow-[0_18px_40px_rgba(134,214,29,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lime/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPredicting ? "Analyzing..." : "Get result"}
        </button>

        <div className="w-full rounded-[24px] border border-white/70 bg-white/74 px-4 py-4">
          <p className="text-sm font-semibold text-ink">
            {imageFile ? imageFile.name : "Waiting for photo/file"}
          </p>
          <p className="mt-1 text-sm leading-6 text-ink/56">
            {imageFile
              ? "Your image is loaded and ready for analysis."
              : activeTab === "camera"
              ? "Please capture a clear photo of the skin lesion."
              : "Drag or select a clear image file to run the scan."}
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.22em] text-sage">
            {imageFile ? "Tap the button to analyze" : "Provide image to unlock analysis"}
          </p>
        </div>
      </div>
    </article>
  );
}
