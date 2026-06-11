import { useEffect, useRef, useState } from "react";
import { analyzeSkinImage, MODEL_NAME } from "../lib/api";
import { generateAnalysisReport } from "../lib/report";

export function useSkinAnalysis() {
  const fileInputRef = useRef(null);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [predictMessage, setPredictMessage] = useState("Upload an image to begin.");
  const [prediction, setPrediction] = useState(null);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [imageFile]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  function applySelectedFile(file) {
    setImageFile(file);
    setPrediction(null);
    setPredictMessage(file ? "Ready to analyze." : "Upload an image to begin.");

    if (!file && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openFilePicker() {
    closeCamera();
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const [file] = event.target.files || [];
    applySelectedFile(file || null);
  }

  function handleUploadKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event) {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    closeCamera();

    const [file] = Array.from(event.dataTransfer.files || []).filter((item) =>
      item.type.startsWith("image/"),
    );

    if (!file) {
      setPredictMessage("Drop a PNG or JPG image file to continue.");
      return;
    }

    applySelectedFile(file);
  }

  async function startCamera() {
    applySelectedFile(null);
    setCameraError("");
    setIsCameraActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setCameraStream(stream);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Could not access camera. Please check permissions.");
      setIsCameraActive(false);
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  }

  function capturePhoto(videoElement) {
    if (!videoElement) {
      setCameraError("Video feed is not ready.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) {
          setCameraError("Failed to capture photo.");
          return;
        }
        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
        applySelectedFile(file);
        closeCamera();
      }, "image/jpeg", 0.95);
    } catch (err) {
      console.error("Error capturing photo:", err);
      setCameraError("Error capturing photo from video stream.");
    }
  }

  async function handlePredict() {
    if (!imageFile) {
      setPredictMessage("Select an image before running analysis.");
      return;
    }

    setIsPredicting(true);
    setPredictMessage("Analyzing image...");

    try {
      const payload = await analyzeSkinImage(imageFile);
      setPrediction(payload);
      setPredictMessage("Analysis complete.");
    } catch (error) {
      setPredictMessage(error.message);
    } finally {
      setIsPredicting(false);
    }
  }

  async function handleDownloadReport() {
    if (!prediction) {
      return;
    }

    setIsDownloadingReport(true);

    try {
      await generateAnalysisReport({
        prediction,
        imageFile,
        modelName: MODEL_NAME,
      });
    } catch (error) {
      setPredictMessage("The PDF report could not be generated right now.");
    } finally {
      setIsDownloadingReport(false);
    }
  }

  return {
    fileInputRef,
    imageFile,
    previewUrl,
    isDragging,
    isPredicting,
    isDownloadingReport,
    predictMessage,
    prediction,
    topPrediction: prediction?.top_prediction ?? null,
    modelName: MODEL_NAME,
    isCameraActive,
    cameraStream,
    cameraError,
    applySelectedFile,
    openFilePicker,
    handleFileChange,
    handleUploadKeyDown,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePredict,
    handleDownloadReport,
    startCamera,
    closeCamera,
    capturePhoto,
  };
}
