
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { initFirebaseAnalytics } from "./app/lib/firebase";

  void initFirebaseAnalytics();

  createRoot(document.getElementById("root")!).render(<App />);
  