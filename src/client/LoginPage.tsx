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
    const err = mode === "login" ? await login(username.trim(), password) : await register(username.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">
          {mode === "login" ? "We're so excited to see you again!" : "Create your account to get started."}
        </p>

        <div className="login-tabs">
          <button className={`login-tab ${mode==="login"?"active":""}`} onClick={() => { setMode("login"); setError(null); }}>Sign In</button>
          <button className={`login-tab ${mode==="register"?"active":""}`} onClick={() => { setMode("register"); setError(null); }}>Register</button>
        </div>

        <div className="field-group">
          <label className="field-label">Username</label>
          <input className="field-input" value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Enter your username" autoFocus autoCapitalize="none" spellCheck={false} maxLength={32} />
        </div>

        <div className="field-group">
          <label className="field-label">Password</label>
          <input className="field-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Enter your password" maxLength={128} />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button className="login-btn" onClick={submit} disabled={loading || !username.trim() || !password}>
          {loading ? "..." : mode === "login" ? "Log In" : "Register"}
        </button>

        {mode === "register" && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12, textAlign: "center" }}>
            Username: letters, numbers, ., - and _ — min 2 chars. Password min 6 chars.
          </p>
        )}
      </div>
    </div>
  );
}
