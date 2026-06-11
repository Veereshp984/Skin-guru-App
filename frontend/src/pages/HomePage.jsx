import { useEffect, useRef } from "react";
import {
  benefitCards,
  howItWorksSteps,
  infoTiles,
  navItems,
  whyItMattersPoints,
} from "../constants/content";
import { useSkinAnalysis } from "../hooks/useSkinAnalysis";
import { formatFileSize } from "../lib/format";
import { TopNav } from "../components/layout/TopNav";
import { HeroSection } from "../sections/HeroSection";
import { WhyItMattersSection } from "../sections/WhyItMattersSection";
import { BenefitsSection } from "../sections/BenefitsSection";
import { HowItWorksSection } from "../sections/HowItWorksSection";
import { ResultsSection } from "../sections/ResultsSection";

export function HomePage() {
  const resultsRef = useRef(null);
  const {
    fileInputRef,
    imageFile,
    previewUrl,
    isDragging,
    isPredicting,
    isDownloadingReport,
    predictMessage,
    prediction,
    topPrediction,
    modelName,
    openFilePicker,
    handleFileChange,
    handleUploadKeyDown,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePredict,
    handleDownloadReport,
    isCameraActive,
    cameraStream,
    cameraError,
    startCamera,
    closeCamera,
    capturePhoto,
    applySelectedFile,
  } = useSkinAnalysis();

  useEffect(() => {
    if (!prediction || !resultsRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [prediction]);

  const fileSizeLabel = imageFile ? formatFileSize(imageFile.size) : "";

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_30rem),radial-gradient(circle_at_85%_15%,rgba(134,214,29,0.18),transparent_18rem),radial-gradient(circle_at_18%_84%,rgba(82,113,87,0.14),transparent_22rem)]" />
        <div className="pointer-events-none absolute left-[-5rem] top-[10rem] h-44 w-44 rounded-full bg-white/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-4rem] right-[-2rem] h-64 w-64 rounded-full bg-lime/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1680px] px-4 pb-10 pt-4 sm:px-6 xl:px-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <TopNav
            navItems={navItems}
            imageFile={imageFile}
            fileSizeLabel={fileSizeLabel}
            onOpenFilePicker={openFilePicker}
          />

          <main className="mt-6 space-y-6">
            <HeroSection
              infoTiles={infoTiles}
              imageFile={imageFile}
              predictMessage={predictMessage}
              onOpenFilePicker={openFilePicker}
              previewUrl={previewUrl}
              modelName={modelName}
              isDragging={isDragging}
              isPredicting={isPredicting}
              onUploadKeyDown={handleUploadKeyDown}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onPredict={handlePredict}
              fileSizeLabel={fileSizeLabel}
              isCameraActive={isCameraActive}
              cameraStream={cameraStream}
              cameraError={cameraError}
              onStartCamera={startCamera}
              onCloseCamera={closeCamera}
              onCapturePhoto={capturePhoto}
              onClearSelectedFile={() => applySelectedFile(null)}
            />

            <WhyItMattersSection points={whyItMattersPoints} />
            <BenefitsSection cards={benefitCards} />
            <HowItWorksSection steps={howItWorksSteps} />
            <ResultsSection
              sectionRef={resultsRef}
              prediction={prediction}
              topPrediction={topPrediction}
              previewUrl={previewUrl}
              isPredicting={isPredicting}
              isDownloadingReport={isDownloadingReport}
              onDownloadReport={handleDownloadReport}
              onOpenFilePicker={openFilePicker}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
