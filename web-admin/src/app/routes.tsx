import { Link, Navigate, Outlet, createBrowserRouter, useNavigate } from "react-router-dom";
import { AIModeration } from "../pages/AIModeration";
import { Approvals } from "../pages/Approvals";
import { Login } from "../pages/Login";
import { Visits } from "../pages/Visits";
import { clearSession, getManagerAccessState, getSession } from "./session";

function ManagerLayout() {
  const accessState = getManagerAccessState(getSession());
  const navigate = useNavigate();

  if (accessState === "redirect-login") {
    return <Navigate to="/login" replace />;
  }

  if (accessState === "forbidden") {
    return (
      <main className="shell">
        <section className="card">
          <h1>Manager role required</h1>
          <p>Your account is signed in but does not have manager access.</p>
          <Link to="/login">Sign in with another account</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Manager Dashboard</p>
          <h1>AgriTrace Operations</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            clearSession();
            navigate("/login", { replace: true });
          }}
        >
          Log out
        </button>
      </header>
      <nav className="tabs">
        <Link to="/approvals">Approvals</Link>
        <Link to="/visits">Visits</Link>
        <Link to="/ai-moderation">AI Moderation</Link>
      </nav>
      <Outlet />
    </main>
  );
}

export const appRoutes = [
  {
    path: "/",
    element: <Navigate to="/approvals" replace />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    element: <ManagerLayout />,
    children: [
      {
        path: "/approvals",
        element: <Approvals />,
      },
      {
        path: "/visits",
        element: <Visits />,
      },
      {
        path: "/ai-moderation",
        element: <AIModeration />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
];

export const appRouter = createBrowserRouter(appRoutes);
