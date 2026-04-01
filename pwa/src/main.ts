import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { appRouter } from "./app/routes";

const baseUrl = import.meta.env.BASE_URL;

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`${baseUrl}sw.js`).catch(() => {
        console.warn("Service worker registration failed");
      });
    });
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element");
}

ReactDOM.createRoot(rootElement).render(React.createElement(RouterProvider, { router: appRouter }));
registerServiceWorker();
