import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);

    const err =
      mode === "login"
        ? await login(username.trim(), password)
        : await register(username.trim(), password);

    setLoading(false);
    if (err) setError(err);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo">💬</div>
        <h1 className="login-title">chat</h1>
        <p className="login-subtitle">
          {mode === "login"
            ? "Welcome back. Sign in to continue."
            : "Create an account to get started."}
        </p>

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(null); }}
          >
            Sign in
          </button>
          <button
            className={`login-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => { setMode("register"); setError(null); }}
          >
            Register
          </button>
        </div>

        <div className="login-fields">
          <div className="field-group">
            <label className="field-label">Username</label>
            <input
              className="field-input"
              type="text"
              placeholder="your-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={24}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Password</label>
            <input
              className="field-input"
              type="password"
              placeholder={mode === "register" ? "At least 6 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKey}
              maxLength={128}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            className="login-btn"
            onClick={handleSubmit}
            disabled={loading || !username.trim() || !password}
          >
            {loading
              ? "..."
              : mode === "login"
              ? "Sign in →"
              : "Create account →"}
          </button>
        </div>

        {mode === "register" && (
          <p className="login-hint">
            Username: letters, numbers, - and _ only. Min 2 chars.
          </p>
        )}
      </div>
    </div>
  );
}
