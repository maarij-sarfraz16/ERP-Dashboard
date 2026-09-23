import { useState, type FormEvent } from "react";
import { useTheme } from "../hooks/useTheme";

interface Props {
  onSignIn: (username: string, password: string) => Promise<boolean>;
}

export function LoginPage({ onSignIn }: Props) {
  // Mounting the hook here keeps the stored theme applied before the shell
  // (and its toggle) exists.
  useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const ok = await onSignIn(username, password);
    if (!ok) {
      setError("Incorrect username or password.");
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="card login-card load-in" onSubmit={handleSubmit} noValidate>
        <div className="brand">
          <span className="brand-mark">ATS Synthetic</span>
          <span className="brand-sub">HRMS DASHBOARD</span>
        </div>

        <h1 className="login-title">Sign in</h1>

        <label className="login-field">
          <span className="card-label">USERNAME</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="characters"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="login-field">
          <span className="card-label">PASSWORD</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <p className="login-error" role="alert" aria-live="polite">
          {error}
        </p>

        <button type="submit" className="login-submit" disabled={busy || !username || !password}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
