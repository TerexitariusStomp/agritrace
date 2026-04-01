export type UserRole = "manager" | "viewer";

export type Session = {
  email: string;
  role: UserRole;
};

export type AccessState = "redirect-login" | "forbidden" | "granted";

const SESSION_KEY = "web-admin-session";

export function getSession(): Session | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.email || !parsed.role) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

export function getManagerAccessState(session: Session | null): AccessState {
  if (!session) {
    return "redirect-login";
  }

  if (session.role !== "manager") {
    return "forbidden";
  }

  return "granted";
}
