/**
 * Compresses and downscales a webcam screenshot (base64 data URI) using HTML5 Canvas.
 * Fits the image within maxWidth x maxHeight while preserving aspect ratio.
 * 
 * @param {string} dataUri - The base64 data URI of the captured image
 * @param {number} maxWidth - Maximum width of the output image (default 800)
 * @param {number} maxHeight - Maximum height of the output image (default 800)
 * @param {number} quality - JPEG quality between 0.0 and 1.0 (default 0.85)
 * @returns {Promise<File>} A Promise resolving to a File object containing the compressed JPEG
 */
export function compressWebcamImage(dataUri, maxWidth = 800, maxHeight = 800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions preserving aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const widthRatio = maxWidth / width;
        const heightRatio = maxHeight / height;
        const bestRatio = Math.min(widthRatio, heightRatio);

        width = Math.round(width * bestRatio);
        height = Math.round(height * bestRatio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get 2D context from canvas"));
        return;
      }

      // Draw and scale the image onto the canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert canvas to Blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob serialization failed"));
            return;
          }
          const file = new File([blob], `webcam_scan_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          resolve(file);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = (err) => {
      reject(err);
    };

    img.src = dataUri;
  });
}
