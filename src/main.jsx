import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { requestFreshDeploymentReload } from "./utils/runtimeRecovery";
import "./index.css";

window.addEventListener("vite:preloadError", (event) => {
  if (requestFreshDeploymentReload(event.payload)) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("CRUISER service worker could not be registered.", error);
      });
  });
}
