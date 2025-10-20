chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'capture') {
    captureVisible().then(image => sendResponse({ image }))
                    .catch(err => sendResponse({ error: err.toString() }));
    return true; // keep channel open for async response
  }
});

async function captureVisible() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(dataUrl); // return base64 image string
    });
  });
}
