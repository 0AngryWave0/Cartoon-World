let mangaEffectEnabled = false;
let cartoonEdgesEnabled = false;
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];

window.onload = () => {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  // Initialize video feed
  navigator.mediaDevices
    .getUserMedia({ video: { width: 1280, height: 720 } })
    .then((stream) => {
      video.srcObject = stream;
      video.play();

      // Start a continuous loop to draw the video feed onto the canvas
      function drawVideoToCanvas() {
        if (!mangaEffectEnabled && !cartoonEdgesEnabled) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        requestAnimationFrame(drawVideoToCanvas);
      }

      drawVideoToCanvas();

      // Initialize MediaRecorder for recording
      const outputStream = canvas.captureStream(30); // Capture canvas stream at 30 FPS
      mediaRecorder = new MediaRecorder(outputStream, { mimeType: "video/webm" });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);

        // Create a download link
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = "recording.webm";
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        recordedChunks = [];
      };
    })
    .catch((err) => {
      console.error("Error accessing camera:", err);
    });

  // Add event listeners for buttons
  document.getElementById("toggleMangaEffect").addEventListener("click", () => {
    mangaEffectEnabled = !mangaEffectEnabled;
    if (mangaEffectEnabled) {
      applyMangaEffect(video, canvas);
    } else {
      clearCanvas(canvas);
    }
  });

  document.getElementById("toggleCartoonEdges").addEventListener("click", () => {
    cartoonEdgesEnabled = !cartoonEdgesEnabled;
    if (cartoonEdgesEnabled) {
      applyCartoonEdgesEffect(video, canvas);
    } else {
      clearCanvas(canvas);
    }
  });

  document.getElementById("saveSnapshot").addEventListener("click", () => {
    saveSnapshot(canvas, document.getElementById("defaultCanvas0"));
  });
  
  document.getElementById("startRecording").addEventListener("click", () => {
    toggleRecording(canvas, document.getElementById("defaultCanvas0"));
  });
  
};

function applyMangaEffect(videoElement, canvasElement) {
    const ctx = canvasElement.getContext("2d");
  
    function processFrame() {
      if (!mangaEffectEnabled) return;
  
      // Draw the current video frame on the canvas
      ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
  
      // Get image data from the canvas
      const frame = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
      const data = frame.data;
  
      // Convert to grayscale
      const gray = [];
      for (let i = 0; i < data.length; i += 4) {
        const grayscale = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        gray.push(grayscale);
      }
  
      // Apply edge detection (Sobel filter approximation)
      const edges = new Uint8ClampedArray(data.length / 4);
      const width = canvasElement.width;
      const height = canvasElement.height;
  
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = y * width + x;
  
          const gx =
            gray[(y - 1) * width + (x + 1)] -
            gray[(y - 1) * width + (x - 1)] +
            2 * gray[y * width + (x + 1)] -
            2 * gray[y * width + (x - 1)] +
            gray[(y + 1) * width + (x + 1)] -
            gray[(y + 1) * width + (x - 1)];
  
          const gy =
            gray[(y - 1) * width + (x - 1)] +
            2 * gray[(y - 1) * width + x] +
            gray[(y - 1) * width + (x + 1)] -
            gray[(y + 1) * width + (x - 1)] -
            2 * gray[(y + 1) * width + x] -
            gray[(y + 1) * width + (x + 1)];
  
          const magnitude = Math.sqrt(gx * gx + gy * gy);
          edges[i] = magnitude > 40 ? 0 : 255; // Apply a threshold
        }
      }
  
      // Create the black-and-white manga effect
      for (let i = 0; i < data.length; i += 4) {
        const index = i / 4;
        data[i] = edges[index]; // Red
        data[i + 1] = edges[index]; // Green
        data[i + 2] = edges[index]; // Blue
        data[i + 3] = 255; // Alpha
      }
  
      // Update the canvas
      ctx.putImageData(frame, 0, 0);
  
      // Continue processing frames
      requestAnimationFrame(processFrame);
    }
  
    processFrame();
  }
  
  

// Cartoon Edges Effect
function applyCartoonEdgesEffect(videoElement, canvasElement) {
    const ctx = canvasElement.getContext("2d");
  
    function processFrame() {
      if (!cartoonEdgesEnabled) return;
  
      // Step 1: Draw the video frame onto the canvas
      ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
      const frame = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
      const data = frame.data;
      const width = canvasElement.width;
      const height = canvasElement.height;
  
      // Step 2: Blur the image (Gaussian approximation using box blur)
      const blurred = applyBoxBlur(data, width, height);
  
      // Step 3: Edge detection using Sobel filter (to detect lines)
      const edges = detectEdges(blurred, width, height);
  
      // Step 4: Combine blurred image and edges
      const outputData = new Uint8ClampedArray(data.length);
      for (let i = 0; i < data.length; i += 4) {
        // Blur
        outputData[i] = blurred[i];     // Red
        outputData[i + 1] = blurred[i + 1]; // Green
        outputData[i + 2] = blurred[i + 2]; // Blue
        outputData[i + 3] = 255;        // Alpha
  
        // Overlay edges with thicker lines
        if (edges[i / 4] > 0) {
          outputData[i] = 0;       // Black edge
          outputData[i + 1] = 0;
          outputData[i + 2] = 0;
        }
      }
  
      // Step 5: Draw the combined output back to the canvas
      const outputImage = new ImageData(outputData, width, height);
      ctx.putImageData(outputImage, 0, 0);
  
      requestAnimationFrame(processFrame);
    }
  
    processFrame();
  }
  
  // Helper function: Apply a simple box blur
  function applyBoxBlur(data, width, height) {
    const kernelSize = 5; // Box blur kernel size (5x5)
    const halfKernel = Math.floor(kernelSize / 2);
    const blurred = new Uint8ClampedArray(data.length);
  
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
  
        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            const nx = x + kx;
            const ny = y + ky;
  
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const i = (ny * width + nx) * 4;
              sumR += data[i];
              sumG += data[i + 1];
              sumB += data[i + 2];
              count++;
            }
          }
        }
  
        const i = (y * width + x) * 4;
        blurred[i] = sumR / count;     // Red
        blurred[i + 1] = sumG / count; // Green
        blurred[i + 2] = sumB / count; // Blue
        blurred[i + 3] = 255;          // Alpha
      }
    }
  
    return blurred;
  }
  
  // Helper function: Edge detection using Sobel filter
  function detectEdges(data, width, height) {
    const edges = new Uint8ClampedArray(width * height);
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
  
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const nx = x + kx;
            const ny = y + ky;
            const i = (ny * width + nx) * 4;
            const weightX = sobelX[(ky + 1) * 3 + (kx + 1)];
            const weightY = sobelY[(ky + 1) * 3 + (kx + 1)];
            const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
  
            gx += weightX * gray;
            gy += weightY * gray;
          }
        }
  
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const index = y * width + x;
        edges[index] = magnitude > 100 ? 255 : 0; // Threshold for edge detection
      }
    }
  
    return edges;
  }
  
  
  
  
  
  

// Save snapshot
function saveSnapshot(canvasElement) {
  const link = document.createElement("a");
  link.download = "snapshot.png";
  link.href = canvasElement.toDataURL("image/png");
  link.click();
}

// Toggle video recording
function toggleRecording() {
  isRecording = !isRecording;
  if (isRecording) {
    recordedChunks = [];
    mediaRecorder.start();
    alert("Recording started.");
  } else {
    alert("Recording stopped and saved.");
  }
}

// Clear canvas
function clearCanvas(canvasElement) {
  const ctx = canvasElement.getContext("2d");
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
}
