import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserRole, saveSession } from "../app/session";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const role: UserRole = email.toLowerCase().startsWith("manager") ? "manager" : "viewer";
    saveSession({ email, role });
    setPassword("");
    navigate("/approvals");
  };

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">AgriTrace</p>
        <h1>Manager Sign In</h1>
        <form className="form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit">Sign In</button>
        </form>
      </section>
    </main>
  );
}
