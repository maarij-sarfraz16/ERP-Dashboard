import { useState, type FormEvent } from "react";
import { useTheme } from "../hooks/useTheme";
import { AtsLogo } from "../components/common/AtsLogo";
import { SignInError } from "../auth/auth";

interface Props {
  onSignIn: (username: string, password: string) => Promise<void>;
}

export function LoginPage({ onSignIn }: Props) {
  // Mounting the hook here keeps the stored theme applied before the shell
  // (and its toggle) exists.
  const { theme, toggleTheme } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Resolves only on success; the shell swaps in and this form unmounts,
      // so `busy` is deliberately left on in that case.
      await onSignIn(username, password);
    } catch (err) {
      // The server decides the wording for a refused sign-in — one generic
      // message that never says which of the two fields was wrong. Anything
      // else is the request itself failing.
      setError(
        err instanceof SignInError
          ? err.message
          : "Could not reach the sign-in server. Please try again.",
      );
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <button
        type="button"
        className="login-theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle dark mode"
      >
        {theme === "dark" ? "Dark" : "Light"}
      </button>

      <div className="login-layout load-in">
        <form className="card login-card" onSubmit={handleSubmit} noValidate>
          <div className="login-brand">
            <AtsLogo size={34} className="login-logo" />
            <div className="brand">
              <span className="brand-mark">ATS Synthetic</span>
              <span className="brand-sub">HRMS DASHBOARD</span>
            </div>
          </div>

          <div className="login-card-head">
            <h1 className="login-title">Sign in</h1>
            <p className="login-subtitle">Sign in to continue.</p>
          </div>

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
            <span className="login-password">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="login-reveal"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>

          <p className="login-error" role="alert" aria-live="polite">
            {error}
          </p>

          <button
            type="submit"
            className="login-submit"
            disabled={busy || !username || !password}
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
