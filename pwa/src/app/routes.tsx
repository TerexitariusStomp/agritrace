import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
], {
  basename: import.meta.env.BASE_URL,
});
