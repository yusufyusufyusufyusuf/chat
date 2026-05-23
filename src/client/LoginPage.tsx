import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setLoading(true); setError(null);
    const err = mode === "login"
      ? await login(username.trim(), password)
      : await register(username.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="login-bg">
      <div className="login-left">
        <div className="login-card">
          <h1 className="login-title">
            {mode === "login" ? "Welcome back!" : "Create an account"}
          </h1>
          <p className="login-subtitle">
            {mode === "login"
              ? "We're so excited to see you again!"
              : "Join the community — it's free, always."}
          </p>

          <div className="login-tabs">
            <button
              className={`login-tab ${mode === "login" ? "login-tab--active" : ""}`}
              onClick={() => { setMode("login"); setError(null); }}
            >
              Sign In
            </button>
            <button
              className={`login-tab ${mode === "register" ? "login-tab--active" : ""}`}
              onClick={() => { setMode("register"); setError(null); }}
            >
              Register
            </button>
          </div>

          <div className="field-group">
            <label className="field-label">Username</label>
            <input
              className="field-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Enter your username"
              autoFocus
              autoCapitalize="none"
              autoComplete="username"
              spellCheck={false}
              maxLength={32}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Password</label>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Enter your password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              maxLength={128}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            className="login-btn"
            onClick={submit}
            disabled={loading || !username.trim() || !password}
          >
            {loading ? "Please wait…" : mode === "login" ? "Log In" : "Continue"}
          </button>

          {mode === "register" && (
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 12, lineHeight: 1.5 }}>
              Username: letters, numbers, <code style={{ background: "var(--bg-4)", padding: "1px 4px", borderRadius: 3 }}>.</code>{" "}
              <code style={{ background: "var(--bg-4)", padding: "1px 4px", borderRadius: 3 }}>-</code>{" "}
              <code style={{ background: "var(--bg-4)", padding: "1px 4px", borderRadius: 3 }}>_</code> — 2–32 chars.
              Password min 6 chars.
            </p>
          )}

          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 16, textAlign: "center" }}>
            {mode === "login" ? (
              <>Need an account?{" "}
                <button
                  style={{ color: "var(--text-link)", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
                  onClick={() => { setMode("register"); setError(null); }}
                >
                  Register
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button
                  style={{ color: "var(--text-link)", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
                  onClick={() => { setMode("login"); setError(null); }}
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-right-inner">
          <div className="login-right-logo">
            <svg width="96" height="96" viewBox="0 0 127.14 96.36" fill="white">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
            </svg>
          </div>
          <h2 className="login-right-title">An invite only for you.</h2>
          <p className="login-right-desc">
            Your personal community — servers, channels, voice calls, and DMs.
            It's all here, it's all free.
          </p>
        </div>
      </div>
    </div>
  );
}
