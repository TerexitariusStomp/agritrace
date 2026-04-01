const QUEUE_KEY = "agritrace-offline-queue";

export type OfflineAction = {
  id: string;
  label: string;
  createdAt: string;
};

export function getQueuedActions(): OfflineAction[] {
  const raw = window.localStorage.getItem(QUEUE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as OfflineAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function queueOfflineAction(label: string): Promise<number> {
  const next = [
    ...getQueuedActions(),
    {
      id: `${Date.now()}`,
      label,
      createdAt: new Date().toISOString(),
    },
  ];

  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(next));

  void registerBackgroundSync();

  return next.length;
}

async function registerBackgroundSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }).sync;

    if (syncManager) {
      await syncManager.register("agritrace-offline-sync");
    }
  } catch {
    // non-blocking by design
  }
}
