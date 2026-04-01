import { useEffect, useMemo, useState } from "react";
import { getQueuedActions, queueOfflineAction } from "../offline/sync";
import "../styles.css";

type DeferredInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function App() {
  const [queuedCount, setQueuedCount] = useState(0);
  const [installEvent, setInstallEvent] = useState<DeferredInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState("Install to home screen for faster field use");

  useEffect(() => {
    setQueuedCount(getQueuedActions().length);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as DeferredInstallPromptEvent);
      setInstallState("Install is ready");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const offlineLabel = useMemo(() => `Queued actions: ${queuedCount}`, [queuedCount]);

  const handleQueueAction = async () => {
    const total = await queueOfflineAction("Field update");
    setQueuedCount(total);
  };

  const handleInstall = async () => {
    if (!installEvent) {
      setInstallState("Install prompt is not available in this browser session");
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallState(choice.outcome === "accepted" ? "Install accepted" : "Install dismissed");
    setInstallEvent(null);
  };

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">AgriTrace Field</p>
        <h1>Capture now, sync later</h1>
        <p className="copy">Queue work while offline and install the app for one-tap access during field rounds.</p>
        <div className="actions">
          <button type="button" onClick={handleInstall}>
            Install App
          </button>
          <button type="button" className="secondary" onClick={handleQueueAction}>
            Queue Offline Action
          </button>
        </div>
        <p className="status">{installState}</p>
        <p className="status">{offlineLabel}</p>
      </section>
    </main>
  );
}
