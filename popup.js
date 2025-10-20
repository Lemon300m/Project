const captureBtn = document.getElementById('captureBtn');
const log = document.getElementById('log');

// This variable holds the latest screenshot (in memory)
let screenshotData = null;

captureBtn.addEventListener('click', async () => {
  log.textContent = 'Capturing...';

  // Ask background to take screenshot of the current tab
  chrome.runtime.sendMessage({ action: 'capture' }, async (response) => {
    if (chrome.runtime.lastError) {
      log.textContent = 'Error: ' + chrome.runtime.lastError.message;
      return;
    }
    if (!response || !response.image) {
      log.textContent = 'Failed to capture.';
      return;
    }

    // Store screenshot in variable (Base64 data URL)
    screenshotData = response.image;

    // Example: convert to Blob if you need binary data
    const blob = await (await fetch(screenshotData)).blob();

    log.textContent = `Screenshot captured in memory.\nSize: ${blob.size} bytes\nType: ${blob.type}`;

    // Example: you can now call your processing function
    // processScreenshot(blob);
  });
});
