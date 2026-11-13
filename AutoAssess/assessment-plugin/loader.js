// Restore only the panel that the user opened in this tab. No question/model work here.
(() => {
  if (window !== window.top) return;
  document.getElementById('assessment-assistant')?.remove();
  chrome.runtime.sendMessage({ type: "restorePanel" }).catch(() => {});
})();
