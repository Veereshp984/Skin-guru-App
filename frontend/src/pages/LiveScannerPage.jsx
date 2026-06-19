import { useState, useEffect, useRef } from "react";
import { TopNav } from "../components/layout/TopNav";
import { navItems } from "../constants/content";
import { compressWebcamImage } from "../lib/image";
import { analyzeSkinImage, getAccessToken, API_BASE } from "../lib/api";
import { ResultRow } from "../components/results/ResultRow";
import { formatProbability } from "../lib/format";

export function LiveScannerPage() {
  const videoRef = useRef(null);
  const resultsRef = useRef(null);

  // Stream and device management
  const [stream, setStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [facingMode, setFacingMode] = useState("environment"); // default to back camera
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState("");

  // Capture preview states
  const [capturedImage, setCapturedImage] = useState(null);
  
  // Loading and Diagnostic Step states
  const [isPredicting, setIsPredicting] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  
  // Results states
  const [prediction, setPrediction] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState("");

  // Periodically change loading text messages to feel organic and responsive
  useEffect(() => {
    if (!isPredicting) return;

    const steps = [
      "Accessing image canvas...",
      "Downscaling resolution to 800x800...",
      "Compressing to JPEG at 85% quality...",
      "Sending payload to secure ML backend...",
      "Running deep learning ensemble model...",
      "Structuring clinical outcome report..."
    ];

    let currentStepIndex = 0;
    setLoadingStep(steps[0]);

    const interval = setInterval(() => {
      currentStepIndex = (currentStepIndex + 1) % steps.length;
      setLoadingStep(steps[currentStepIndex]);
    }, 1200);

    return () => clearInterval(interval);
  }, [isPredicting]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Restart stream when constraints change
  useEffect(() => {
    if (cameraActive) {
      startCamera();
    }
  }, [selectedDeviceId, facingMode]);

  async function startCamera() {
    setError("");
    setCameraPermissionError("");
    
    // Stop any existing tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    const constraints = {
      audio: false,
      video: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : { facingMode: facingMode }
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);

      // Enumerate available video devices
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraPermissionError("Could not access camera. Please verify permissions in your browser.");
      setCameraActive(false);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  }

  function handleDeviceChange(e) {
    setSelectedDeviceId(e.target.value);
  }

  function toggleFacingMode() {
    // Reset selected device ID to allow switching by facingMode
    setSelectedDeviceId("");
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }

  function handleCapture() {
    const video = videoRef.current;
    if (video) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      // Handle mirroring on preview if using front camera
      if (facingMode === "user" && !selectedDeviceId) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL("image/jpeg", 0.95);
      
      setCapturedImage(dataUri);
      stopCamera();
    }
  }

  function handleRetake() {
    setCapturedImage(null);
    setPrediction(null);
    setError("");
    startCamera();
  }

  async function handleConfirmScan() {
    if (!capturedImage) return;

    setIsPredicting(true);
    setError("");
    setPrediction(null);

    try {
      // 1. Client-Side Image downscaling & compression to 800x800 at 0.85 quality
      const compressedFile = await compressWebcamImage(capturedImage, 800, 800, 0.85);

      // 2. Upload with source = webcam parameter
      const payload = await analyzeSkinImage(compressedFile, "webcam");
      
      setPrediction(payload);
      
      // Scroll to results section smoothly
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);

    } catch (err) {
      console.error("API error:", err);
      setError(err.message || "Failed to analyze skin image. Please try again.");
    } finally {
      setIsPredicting(false);
    }
  }

  async function handleDownloadPDF() {
    if (!prediction) return;
    const reportId = prediction.report_id;
    const downloadUrl = `${API_BASE}/api/reports/download/${reportId}?token=${getAccessToken()}`;
    const isCapacitor = !!window.Capacitor;
    if (isCapacitor) {
      window.open(downloadUrl, "_system");
      return;
    }

    setDownloadingPdf(true);
    try {
      const response = await fetch(`${API_BASE}/api/reports/download/${reportId}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to download PDF report from server.");
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `SkinGuru_Live_Report_${prediction.top_prediction.name.replace(/\s+/g, "_") || reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("PDF download error:", err);
      alert(err.message || "Error exporting PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="relative overflow-hidden">
        {/* Glowing backdrop ambient decorations */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_30rem),radial-gradient(circle_at_85%_15%,rgba(134,214,29,0.18),transparent_18rem),radial-gradient(circle_at_18%_84%,rgba(82,113,87,0.14),transparent_22rem)]" />
        <div className="pointer-events-none absolute left-[-5rem] top-[10rem] h-44 w-44 rounded-full bg-white/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-4rem] right-[-2rem] h-64 w-64 rounded-full bg-lime/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-4 sm:px-6 lg:px-8">
          <TopNav navItems={navItems} />

          <header className="mt-8 text-center max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-[0.3em] text-sage font-bold">Live Clinical scanner</p>
            <h1 className="mt-2 font-display text-4xl sm:text-5xl leading-none">Real-Time Skin Assessment</h1>
            <p className="mt-3 text-sm text-ink/60">
              Assesses skin anomalies using camera hardware with high-precision positioning guides. Fits images and runs predictions securely in real-time.
            </p>
          </header>

          <main className="mt-8 max-w-4xl mx-auto">
            {/* Camera Console */}
            <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-white/60 p-6 shadow-soft backdrop-blur-2xl">
              
              {/* Permission or Initial Scan Trigger Panel */}
              {!cameraActive && !capturedImage && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-lime/20 text-forest shadow-halo animate-pulse">
                    <span className="text-3xl">📷</span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-ink">Camera Access Required</h3>
                  <p className="mt-2 text-sm text-ink/50 max-w-md">
                    To scan skin anomalies in real-time, please activate the camera. Grant camera hardware access when prompted by the browser.
                  </p>
                  
                  {cameraPermissionError && (
                    <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-xs text-rose-700 max-w-md">
                      {cameraPermissionError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={startCamera}
                    className="mt-6 rounded-full bg-forest px-8 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    Activate Camera Scan
                  </button>
                </div>
              )}

              {/* Streaming Video Workspace */}
              {cameraActive && !capturedImage && (
                <div className="flex flex-col items-center">
                  
                  {/* Camera control bar */}
                  <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-4 bg-stone-100/60 p-3 rounded-2xl border border-line">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-sage">Active Source:</label>
                      {devices.length > 0 ? (
                        <select
                          value={selectedDeviceId}
                          onChange={handleDeviceChange}
                          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink focus:outline-none"
                        >
                          <option value="">Default Facing Constraint</option>
                          {devices.map((device, i) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Camera ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-ink/60">Detecting devices...</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={toggleFacingMode}
                      className="rounded-xl border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink transition hover:bg-stone-50"
                    >
                      🔄 Switch Camera ({facingMode === "user" ? "Front" : "Back"})
                    </button>
                  </div>

                  {/* Video Box with Crosshair Guides */}
                  <div className="relative w-full max-w-xl aspect-square overflow-hidden rounded-3xl border border-line bg-black flex items-center justify-center shadow-halo">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className={`w-full h-full object-cover ${
                        facingMode === "user" && !selectedDeviceId ? "scale-x-[-1]" : ""
                      }`}
                    />

                    {/* Laser Holographic Overlay Target */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <defs>
                        <mask id="overlay-mask">
                          <rect width="100%" height="100%" fill="white" />
                          <circle cx="50%" cy="50%" r="120" fill="black" />
                        </mask>
                      </defs>
                      <rect
                        width="100%"
                        height="100%"
                        fill="rgba(31, 39, 35, 0.42)"
                        mask="url(#overlay-mask)"
                      />
                      {/* Reticle guide line */}
                      <circle
                        cx="50%"
                        cy="50%"
                        r="120"
                        stroke="#86D61D"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray="6 6"
                        className="animate-pulse"
                      />
                      {/* Outer target markings */}
                      <circle cx="50%" cy="50%" r="130" stroke="rgba(134, 214, 29, 0.3)" strokeWidth="1" fill="none" />
                      <path d="M 50 10 L 50 20" stroke="#86D61D" strokeWidth="3" strokeLinecap="round" />
                      <path d="M 50 90 L 50 100" stroke="#86D61D" strokeWidth="3" strokeLinecap="round" transform="translate(0, 480)" />
                      {/* Crosshairs */}
                      <line x1="50%" y1="20%" x2="50%" y2="28%" stroke="#86D61D" strokeWidth="2.5" />
                      <line x1="50%" y1="72%" x2="50%" y2="80%" stroke="#86D61D" strokeWidth="2.5" />
                      <line x1="20%" y1="50%" x2="28%" y2="50%" stroke="#86D61D" strokeWidth="2.5" />
                      <line x1="72%" y1="50%" x2="80%" y2="50%" stroke="#86D61D" strokeWidth="2.5" />
                    </svg>

                    <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
                      <span className="inline-block rounded-full bg-forest/80 backdrop-blur-md px-4 py-1.5 text-xs text-white border border-white/10 font-medium tracking-wide">
                        Align anomaly within green circle
                      </span>
                    </div>
                  </div>

                  {/* Capture Trigger Buttons */}
                  <div className="mt-6 flex gap-4 w-full max-w-sm">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="flex-1 rounded-full border border-line bg-white py-3 text-sm font-semibold text-ink transition hover:bg-stone-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCapture}
                      className="flex-[2] rounded-full bg-forest py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                    >
                      📸 Capture Scan
                    </button>
                  </div>
                </div>
              )}

              {/* Snapshot Captured Preview Screen */}
              {capturedImage && (
                <div className="flex flex-col items-center">
                  <h4 className="text-sm uppercase tracking-wider text-sage font-semibold mb-3">Snapshot Preview</h4>
                  
                  <div className="relative w-full max-w-xl aspect-square overflow-hidden rounded-3xl border border-line bg-black">
                    <img src={capturedImage} alt="Captured scan" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                  </div>

                  {/* Actions to Confirm or Retake */}
                  <div className="mt-6 flex gap-4 w-full max-w-sm">
                    <button
                      type="button"
                      onClick={handleRetake}
                      disabled={isPredicting}
                      className="flex-1 rounded-full border border-line bg-white py-3 text-sm font-semibold text-ink transition hover:bg-stone-50 disabled:opacity-50"
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmScan}
                      disabled={isPredicting}
                      className="flex-[2] rounded-full bg-lime py-3 text-sm font-bold text-forest hover:shadow-[0_8px_24px_rgba(134,214,29,0.3)] transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPredicting ? "Processing..." : "Confirm & Analyze"}
                    </button>
                  </div>
                </div>
              )}

            </section>

            {/* Inference Loader Glassmorphism Overlay */}
            {isPredicting && (
              <section className="mt-6 rounded-[36px] border border-white/60 bg-white/70 p-12 text-center shadow-soft backdrop-blur-md animate-rise flex flex-col items-center justify-center">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-lime/30 border-t-lime" />
                <h3 className="mt-6 text-lg font-bold text-ink">Analyzing Lesion</h3>
                <p className="mt-2 text-sm text-sage font-medium tracking-wide min-h-[20px]">
                  {loadingStep}
                </p>
                <p className="mt-4 text-xs text-ink/40 max-w-xs leading-relaxed">
                  SkinGuru uses canvas downscaling to optimize capture images before inference processing.
                </p>
              </section>
            )}

            {/* Error Message Box */}
            {error && (
              <section className="mt-6 rounded-3xl border border-rose-100 bg-rose-50/50 p-6 text-center text-rose-700 shadow-sm">
                <p className="font-semibold">{error}</p>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="mt-4 rounded-full bg-rose-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
                >
                  Restart Scanner
                </button>
              </section>
            )}

            {/* Assessment Report Results Card */}
            {prediction && (
              <section
                ref={resultsRef}
                className="mt-8 scroll-mt-28 rounded-[40px] border border-white/70 bg-white/60 p-6 shadow-soft backdrop-blur-2xl sm:p-8"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sage font-bold">Analysis Output</p>
                    <h2 className="mt-2 font-display text-3xl leading-none">Diagnostic Prediction</h2>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-full bg-[#eef3ea] px-4 py-2 text-sm font-semibold text-sage">
                      Confidence {formatProbability(prediction.top_prediction.probability)}
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      disabled={downloadingPdf}
                      className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {downloadingPdf ? "Exporting PDF..." : "Export Detailed PDF"}
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                  
                  {/* Scanned Card */}
                  <article className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,#223029_0%,#314238_100%)] p-6 text-white shadow-device flex flex-col justify-between">
                    <div className="absolute right-0 top-0 h-32 w-32 bg-lime/20 blur-3xl rounded-full pointer-events-none" />
                    
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.24em] text-white/50">Top Match</p>
                        <span className="text-[10px] uppercase bg-white/10 px-2.5 py-1 rounded-full text-white/80 font-mono">
                          v{prediction.model_version || "1.0"}
                        </span>
                      </div>

                      {capturedImage && (
                        <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 aspect-video">
                          <img src={capturedImage} alt="Lesion capture" className="h-full w-full object-cover" />
                        </div>
                      )}

                      <h3 className="mt-5 font-display text-3xl sm:text-4xl leading-none text-lime">{prediction.top_prediction.name}</h3>
                      
                      <div className="mt-4 flex flex-wrap gap-2 items-center">
                        <span className="inline-flex rounded-full border border-white/12 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
                          {prediction.top_prediction.code}
                        </span>
                        <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-mono text-white/80">
                          Capture Mode: WEBCAM
                        </span>
                      </div>

                      <p className="mt-5 text-sm leading-6 text-white/78">{prediction.top_prediction.description}</p>
                    </div>

                    <div className="mt-6 border-t border-white/10 pt-5 space-y-2 text-[12px] text-white/60">
                      <div className="flex justify-between items-center">
                        <span>Report ID:</span>
                        <span className="font-mono text-white select-all bg-white/5 px-2 py-0.5 rounded text-[10px]">
                          {prediction.report_id}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Inference Duration:</span>
                        <span className="text-lime font-semibold">{prediction.processing_time_ms} ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Database Source:</span>
                        <span className="text-white">webcam</span>
                      </div>
                    </div>
                  </article>

                  {/* Differential Diagnoses list */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-sage mb-1">Differential Diagnosis Rankings</h4>
                    {prediction.predictions.slice(0, 4).map((entry, index) => (
                      <ResultRow key={entry.code} entry={entry} index={index} />
                    ))}

                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={handleRetake}
                        className="flex-1 rounded-full border border-line bg-white py-3 text-sm font-semibold text-ink transition hover:bg-stone-50"
                      >
                        Scan Another lesion
                      </button>
                    </div>
                  </div>

                </div>

              </section>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}
