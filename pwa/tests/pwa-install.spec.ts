import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app/App";

function setServiceWorkerMock(value: unknown): void {
  Object.defineProperty(window.navigator, "serviceWorker", {
    value,
    configurable: true,
  });
}

describe("field workflow PWA shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setServiceWorkerMock(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows install affordance and allows queueing an offline action", async () => {
    const user = userEvent.setup();

    render(React.createElement(App));

    expect(
      screen.getByRole("button", { name: /install app/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /queue offline action/i }));

    expect(screen.getByText(/queued actions: 1/i)).toBeInTheDocument();
  });

  it("updates install status when deferred prompt resolves", async () => {
    const user = userEvent.setup();
    render(React.createElement(App));

    const installEvent = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    };
    installEvent.prompt = async () => undefined;
    installEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });

    window.dispatchEvent(installEvent);

    await user.click(screen.getByRole("button", { name: /install app/i }));

    expect(screen.getByText(/install accepted/i)).toBeInTheDocument();
  });

  it("queues offline action even when service worker sync fails", async () => {
    const user = userEvent.setup();
    setServiceWorkerMock({
      ready: Promise.resolve({
        sync: {
          register: () => Promise.reject(new Error("sync registration failed")),
        },
      }),
    });

    render(React.createElement(App));

    await user.click(screen.getByRole("button", { name: /queue offline action/i }));

    expect(screen.getByText(/queued actions: 1/i)).toBeInTheDocument();
  });
});
