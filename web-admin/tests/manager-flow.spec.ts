import { beforeEach, describe, expect, it } from "vitest";
import { appRoutes } from "../src/app/routes";
import { getManagerAccessState, getSession, saveSession } from "../src/app/session";
import { approveItem, initialApprovalItems } from "../src/pages/Approvals";

describe("manager dashboard flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns redirect state when no session exists", () => {
    expect(getManagerAccessState(null)).toBe("redirect-login");
  });

  it("returns forbidden state for non-manager roles", () => {
    saveSession({ email: "auditor@agritrace.test", role: "viewer" });
    expect(getManagerAccessState(getSession())).toBe("forbidden");
  });

  it("allows managers and supports approvals action", () => {
    saveSession({ email: "manager.ops@agritrace.test", role: "manager" });

    expect(getManagerAccessState(getSession())).toBe("granted");

    const updated = approveItem(initialApprovalItems, "sub-401");
    expect(updated.find((item) => item.id === "sub-401")?.approved).toBe(true);
  });

  it("handles corrupt session payload safely", () => {
    window.localStorage.setItem("web-admin-session", "not-json");
    expect(getSession()).toBeNull();
  });

  it("persists and restores valid session payload", () => {
    saveSession({ email: "manager@agritrace.test", role: "manager" });
    expect(getSession()).toEqual({ email: "manager@agritrace.test", role: "manager" });
  });

  it("defines protected manager routes and wildcard fallback", () => {
    const protectedRoutes = appRoutes.find((route) => "children" in route && route.children)?.children ?? [];
    const protectedPaths = protectedRoutes.map((route) => route.path);

    expect(protectedPaths).toContain("/approvals");
    expect(protectedPaths).toContain("/visits");
    expect(protectedPaths).toContain("/ai-moderation");
    expect(appRoutes.some((route) => route.path === "*")).toBe(true);
  });
});
