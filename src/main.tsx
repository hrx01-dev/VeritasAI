import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { initFirebaseAnalytics } from "./app/lib/firebase";

const savedTheme = localStorage.getItem("veritasai_theme");
document.documentElement.classList.toggle("dark", savedTheme !== "light");

// Vite emits this event when a lazy-loaded chunk belongs to an older
// deployment and is no longer available. Reload once so the browser gets
// the current index.html and its current asset manifest.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();

  const reloadKey = "veritasai:vite-preload-reload";
  const lastReload = sessionStorage.getItem(reloadKey);
  const now = Date.now();

  // Prevent an infinite reload loop if the asset is genuinely unavailable.
  if (!lastReload || now - Number(lastReload) > 30_000) {
    sessionStorage.setItem(reloadKey, String(now));
    window.location.reload();
  }
});

void initFirebaseAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
