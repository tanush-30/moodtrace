const { invoke } = window.__TAURI__?.core || {
  invoke: async (cmd, args) => {
    console.log(`[MOCK IPC] Popup Invoke: ${cmd}`, args);
    // In browser mode: do nothing (handled by UI feedback below)
    return {};
  }
};

window.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("affect-grid");
  const closeBtn = document.getElementById("btn-close-popup");

  // --- Floating cursor dot for visual feedback ---
  const cursorDot = document.createElement("div");
  cursorDot.style.cssText = `
    position: absolute;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: rgba(154, 77, 255, 0.85);
    box-shadow: 0 0 10px rgba(154, 77, 255, 0.6);
    transform: translate(-6px, -6px);
    pointer-events: none;
    transition: left 0.05s, top 0.05s;
    z-index: 10;
    display: none;
  `;
  grid.appendChild(cursorDot);

  grid.addEventListener("mouseenter", () => { cursorDot.style.display = "block"; });
  grid.addEventListener("mouseleave", () => { cursorDot.style.display = "none"; });
  grid.addEventListener("mousemove", (e) => {
    const rect = grid.getBoundingClientRect();
    cursorDot.style.left = `${e.clientX - rect.left}px`;
    cursorDot.style.top  = `${e.clientY - rect.top}px`;
  });

  // --- Visual confirmation flash on click ---
  const flash = document.createElement("div");
  flash.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(154, 77, 255, 0.18);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 100;
  `;
  document.body.appendChild(flash);

  function showFlash() {
    flash.style.opacity = "1";
    setTimeout(() => { flash.style.opacity = "0"; }, 200);
  }

  // --- Click handler ---
  grid.addEventListener("click", async (e) => {
    const rect = grid.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const valence = parseFloat(((clickX / rect.width) * 2.0 - 1.0).toFixed(4));
    const arousal  = parseFloat((1.0 - (clickY / rect.height) * 2.0).toFixed(4));

    showFlash();

    try {
      await invoke("submit_label", { valence, arousal });
      await invoke("close_popup");
    } catch (err) {
      console.error("Error submitting self-report label:", err);
    }

    // In browser mode, show a small non-blocking toast instead of alert
    if (!window.__TAURI__) {
      showToast(`Logged — Valence: ${valence.toFixed(2)}, Arousal: ${arousal.toFixed(2)}`);
    }
  });

  // Close button
  closeBtn.addEventListener("click", async () => {
    try {
      await invoke("close_popup");
    } catch (err) {
      console.error(err);
    }
    if (!window.__TAURI__) {
      showToast("Popup closed.");
    }
  });
});

// --- Non-blocking toast notification ---
function showToast(msg) {
  const toast = document.createElement("div");
  toast.innerText = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px; left: 50%; transform: translateX(-50%);
    background: rgba(154, 77, 255, 0.9);
    color: #fff;
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    padding: 10px 20px;
    border-radius: 20px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 9999;
    opacity: 1;
    transition: opacity 0.4s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 2000);
}
