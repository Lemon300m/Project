const captureBtn = document.getElementById('captureBtn');
const log = document.getElementById('log');
const preview = document.getElementById('preview');
const manualModeBtn = document.getElementById('manualModeBtn');
const autoModeBtn = document.getElementById('autoModeBtn');
const manualMode = document.getElementById('manualMode');
const autoMode = document.getElementById('autoMode');
const startDetectionBtn = document.getElementById('startDetectionBtn');
const stopDetectionBtn = document.getElementById('stopDetectionBtn');
const detectionStatus = document.getElementById('detectionStatus');

let screenshotData = null;
let isDetecting = false;
let detectionInterval = null;
let showDebugOverlay = false; // toggle to visualize detection boxes

manualModeBtn.addEventListener('click', () => {
  manualModeBtn.classList.add('active');
  autoModeBtn.classList.remove('active');
  manualMode.style.display = 'block';
  autoMode.style.display = 'none';
  stopDetection();
});

autoModeBtn.addEventListener('click', () => {
  autoModeBtn.classList.add('active');
  manualModeBtn.classList.remove('active');
  autoMode.style.display = 'block';
  manualMode.style.display = 'none';
});

captureBtn.addEventListener('click', async () => {
  await captureScreenshot();
});

startDetectionBtn.addEventListener('click', async () => {
  isDetecting = true;
  startDetectionBtn.style.display = 'none';
  stopDetectionBtn.style.display = 'block';
  detectionStatus.textContent = '🔍 Scanning for faces...';
  detectionStatus.className = 'active';
  log.textContent = 'Face detection started. Checking every 2 seconds...';

  // Repeated detection loop
  detectionInterval = setInterval(async () => {
    if (isDetecting) {
      await detectAndCapture();
    }
  }, 2000);
});

stopDetectionBtn.addEventListener('click', stopDetection);

function stopDetection() {
  isDetecting = false;
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
  startDetectionBtn.style.display = 'block';
  stopDetectionBtn.style.display = 'none';
  detectionStatus.style.display = 'none';

  if (autoMode.style.display !== 'none') {
    log.textContent = 'Face detection stopped.';
  }
}

async function captureScreenshot() {
  log.textContent = 'Capturing...';
  preview.innerHTML = '';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

    screenshotData = dataUrl;
    const blob = await (await fetch(screenshotData)).blob();

    const img = document.createElement('img');
    img.src = screenshotData;
    img.style.width = '100%';
    img.style.borderRadius = '4px';
    img.style.marginTop = '10px';
    preview.appendChild(img);

    log.textContent = `Screenshot captured!\nSize: ${(blob.size / 1024).toFixed(2)} KB\nType: ${blob.type}`;
  } catch (error) {
    log.textContent = 'Error: ' + error.message;
    console.error('Capture error:', error);
  }
}

async function cropImage(imageDataUrl, bounds) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = bounds.width;
      canvas.height = bounds.height;

      ctx.drawImage(
        img,
        bounds.x, bounds.y, bounds.width, bounds.height, // source
        0, 0, bounds.width, bounds.height                // destination
      );

      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageDataUrl;
  });
}

async function detectAndCapture() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

    const result = await detectFace(dataUrl);

    if (result.hasFace) {
      detectionStatus.textContent = '✅ Face detected! Capturing...';

      const croppedImage = await cropImage(dataUrl, result.bounds);
      screenshotData = croppedImage;

      const blob = await (await fetch(screenshotData)).blob();

      // Display the cropped screenshot
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = screenshotData;
      img.style.width = '100%';
      img.style.borderRadius = '4px';
      img.style.marginTop = '10px';
      preview.appendChild(img);

      log.textContent = `Face detected and captured!\nSize: ${(blob.size / 1024).toFixed(2)} KB\nType: ${blob.type}\nCropped to: ${result.bounds.width}x${result.bounds.height}px\nTimestamp: ${new Date().toLocaleTimeString()}`;

      // Stop detection after success
      stopDetection();
      detectionStatus.textContent = '✅ Face captured and zoomed!';
      detectionStatus.className = 'active';
    }
  } catch (error) {
    console.error('Detection error:', error);
  }
}

async function detectFace(imageDataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let minX = canvas.width, minY = canvas.height;
      let maxX = 0, maxY = 0;
      let skinPixels = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (
            r > 95 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15 &&
            r - b > 15
          ) {
            skinPixels++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const totalPixels = canvas.width * canvas.height;
      const skinRatio = skinPixels / totalPixels;
      const faceWidth = maxX - minX;
      const faceHeight = maxY - minY;

      if (skinRatio > 0.02 && faceWidth > 60 && faceHeight > 60) {
        const paddingX = Math.floor(faceWidth * 0.3);
        const paddingY = Math.floor(faceHeight * 0.4);

        const bounded = (val, min, max) => Math.max(min, Math.min(val, max));

        const cropX = bounded(minX - paddingX, 0, canvas.width - 1);
        const cropY = bounded(minY - paddingY, 0, canvas.height - 1);
        const cropWidth = bounded(faceWidth + paddingX * 2, 1, canvas.width - cropX);
        const cropHeight = bounded(faceHeight + paddingY * 2.5, 1, canvas.height - cropY);

        // Optional: Debug overlay
        if (showDebugOverlay) {
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 4;
          ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
          preview.innerHTML = '';
          const debugImg = new Image();
          debugImg.src = canvas.toDataURL();
          debugImg.style.width = '100%';
          debugImg.style.borderRadius = '4px';
          preview.appendChild(debugImg);
        }

        resolve({
          hasFace: true,
          bounds: { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
        });
      } else {
        resolve({ hasFace: false });
      }
    };
    img.src = imageDataUrl;
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'd') {
    showDebugOverlay = !showDebugOverlay;
    log.textContent = `Debug overlay ${showDebugOverlay ? 'enabled' : 'disabled'}.`;
  }
});
