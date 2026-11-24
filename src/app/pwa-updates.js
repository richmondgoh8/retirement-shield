import { $ } from "./format.js";

export function setupServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator)) return;
  const updateBtn = $("#app-update-btn");
  const pageRev =
    document.querySelector('meta[name="app-revision"]')?.content || "dev";
  const hadController = Boolean(navigator.serviceWorker.controller);
  let lastCheckAt = 0;

  let swRegRef = null;
  let reloadingOnSwChange = false;
  const revealUpdate = () => {
    if (updateBtn && updateBtn.hidden) {
      updateBtn.hidden = false;
      const srStatus = $("#sr-status");
      if (srStatus) {
        srStatus.textContent =
          "A newer version of Retirement Shield is ready to install";
      }
    }
  };

  if (updateBtn) {
    updateBtn.addEventListener("click", () => {
      if (swRegRef?.waiting) {
        reloadingOnSwChange = true;
        swRegRef.waiting.postMessage({ type: "SKIP_WAITING" });
      } else {
        window.location.reload();
      }
    });
  }

  const verifyRevision = (worker) => {
    if (!worker || pageRev === "dev" || typeof MessageChannel === "undefined")
      return;
    try {
      const ch = new MessageChannel();
      ch.port1.onmessage = (event) => {
        const swRev = String(event.data?.cacheVersion || "").replace(
          "retirement-shield-",
          "",
        );
        if (swRev && swRev !== pageRev) revealUpdate();
      };
      worker.postMessage({ type: "GET_VERSION" }, [ch.port2]);
    } catch {
      // Ignore postMessage failure on torn-down workers
    }
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingOnSwChange) {
      window.location.reload();
      return;
    }
    if (hadController) revealUpdate();
    verifyRevision(navigator.serviceWorker.controller);
  });

  navigator.serviceWorker
    .register("sw.js", { updateViaCache: "none" })
    .then((reg) => {
      swRegRef = reg;
      verifyRevision(navigator.serviceWorker.controller || reg.active);
      if (reg.waiting && navigator.serviceWorker.controller) revealUpdate();
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            revealUpdate();
          }
        });
      });

      const checkForUpdate = () => {
        if (!navigator.onLine) return;
        const now = Date.now();
        if (now - lastCheckAt < 120_000) return;
        lastCheckAt = now;
        reg.update().catch(() => {});
        verifyRevision(navigator.serviceWorker.controller || reg.active);
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("online", checkForUpdate);
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) checkForUpdate();
      });
    })
    .catch(() => {});
}
