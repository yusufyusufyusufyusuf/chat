import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { uploadFile } from "./api";

interface Props { onClose: () => void; }

type Section =
  | "My Account" | "Profile" | "Privacy & Safety" | "Authorized Apps" | "Connections"
  | "Nitro" | "Server Boost" | "Gift Inventory"
  | "Appearance" | "Accessibility" | "Voice & Video" | "Text & Images" | "Notifications"
  | "Keybinds" | "Language";

const BANNER_COLORS = [
  "#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245",
  "#ff73fa", "#f47fff", "#3ba55d", "#1abc9c", "#e67e22",
];

const NITRO_FEATURES = [
  ["🖼️", "Animated Avatars",    "Upload GIF avatars that animate everywhere"],
  ["📁", "Large File Uploads",  "Up to 500 MB per file upload"],
  ["🎨", "Custom Themes",       "Server color themes and customization"],
  ["😀", "Custom Emojis",       "Use emojis from any server you're in"],
  ["🚀", "Server Boosts",       "Boost your favorite servers"],
  ["🎖️", "Profile Badges",      "Exclusive Nitro badges on your profile"],
  ["📺", "HD Streaming",        "Stream in 1080p 60fps quality"],
  ["✏️", "Profile Banner",      "Custom banner image on your profile"],
  ["🔤", "Custom Tag",          "Customize your discriminator"],
  ["🔖", "Longer Bio",          "Extended bio up to 300 characters"],
];

export function SettingsPage({ onClose }: Props) {
  const { user, logout, updateProfile } = useAuth();
  const [active, setActive] = useState<Section>("My Account");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [bannerColor, setBannerColor] = useState(user?.bannerColor ?? "#5865f2");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    await updateProfile({ displayName, bio, bannerColor });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file, "avatar");
      await updateProfile({ avatarUrl: url });
    } catch { /* ignore */ }
  };

  const copyUserId = () => {
    if (!user) return;
    navigator.clipboard?.writeText(user.userId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    switch (active) {
      case "My Account":
        return (
          <>
            <div className="settings-title">My Account</div>

            <div className="settings-section">
              <div className="settings-avatar-row">
                <div className="settings-avatar" onClick={() => fileRef.current?.click()}>
                  {user?.avatarUrl
                    ? <img src={user.avatarUrl} alt="avatar" />
                    : <span style={{ fontSize: 32, fontWeight: 700 }}>{user?.displayName?.[0]?.toUpperCase()}</span>}
                  <div className="settings-avatar-overlay">📷</div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatar} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{user?.displayName}</div>
                  <div style={{ fontSize: 14, color: "var(--text-3)" }}>@{user?.username}</div>
                  {user?.isNitro
                    ? <span className="tag tag-nitro" style={{ marginTop: 6, display: "inline-flex" }}>✨ Nitro</span>
                    : <span style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6, display: "block" }}>Free</span>
                  }
                </div>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Account Information</div>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Username</div>
                  <div className="settings-row-value">@{user?.username}</div>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Display Name</div>
                  <div className="settings-row-value">{user?.displayName}</div>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">User ID</div>
                  <div className="settings-row-value" style={{ fontSize: 11, letterSpacing: 0.3 }}>{user?.userId}</div>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "4px 10px", border: "1px solid var(--border)" }}
                  onClick={copyUserId}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Member Since</div>
                  <div className="settings-row-value">{new Date(user?.createdAt ?? 0).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Password & Authentication</div>
              <div style={{ color: "var(--text-3)", fontSize: 14, marginBottom: 12 }}>
                Change your password to keep your account secure.
              </div>
              <button className="btn btn-ghost" style={{ border: "1px solid var(--border)", fontSize: 14 }} disabled>
                Change Password
              </button>
            </div>
          </>
        );

      case "Profile":
        return (
          <>
            <div className="settings-title">User Profile</div>

            <div className="settings-section">
              <div className="settings-section-title">Display Name</div>
              <input
                className="field-input"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={32}
                placeholder="Display name"
              />
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{displayName.length}/32</div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">About Me</div>
              <textarea
                className="field-input"
                style={{ minHeight: 100, borderRadius: "var(--radius-sm)", padding: "10px 12px" }}
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={190}
                placeholder="Tell others a bit about yourself."
              />
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{bio.length}/190</div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Profile Color / Banner</div>
              <div style={{ fontSize: 14, color: "var(--text-3)", marginBottom: 12 }}>
                Choose a color for your profile banner.
              </div>
              <div className="color-swatches">
                {BANNER_COLORS.map(c => (
                  <div
                    key={c}
                    className={`color-swatch ${bannerColor === c ? "color-swatch--active" : ""}`}
                    style={{ background: c }}
                    onClick={() => setBannerColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Preview</div>
              <div style={{ background: "var(--bg-1)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 300 }}>
                <div style={{ height: 60, background: bannerColor }} />
                <div style={{ padding: "8px 16px 16px" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: bannerColor, border: "4px solid var(--bg-1)", marginTop: -28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff", overflow: "hidden" }}>
                    {user?.avatarUrl
                      ? <img src={user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : user?.displayName?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, marginTop: 8 }}>{displayName || user?.displayName}</div>
                  <div style={{ fontSize: 13, color: "var(--text-3)" }}>@{user?.username}</div>
                  {bio && <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>{bio}</div>}
                </div>
              </div>
            </div>

            <div className="settings-btn-row">
              <button className="btn btn-ghost" onClick={() => { setDisplayName(user?.displayName ?? ""); setBio(user?.bio ?? ""); setBannerColor(user?.bannerColor ?? "#5865f2"); }}>
                Reset
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </>
        );

      case "Nitro":
        return (
          <>
            <div className="settings-title">Nitro</div>
            {user?.isNitro ? (
              <div className="nitro-hero">
                <div className="nitro-hero-title">✨ You have Nitro!</div>
                <div className="nitro-hero-desc">All premium features are unlocked for you. Thank you for your support!</div>
              </div>
            ) : (
              <p style={{ color: "var(--text-3)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                All Nitro features are <strong style={{ color: "var(--text-2)" }}>free during our beta</strong>.
                Enjoy everything — some features may become paid in the future.
              </p>
            )}

            <div className="nitro-plans">
              <div className="nitro-plan">
                <div className="nitro-plan-name">Nitro Basic</div>
                <div className="nitro-plan-price">$2.99</div>
                <div className="nitro-plan-period">/month</div>
                <div className="nitro-plan-features">
                  {[
                    "Custom emoji",
                    "Animated avatar",
                    "Profile badge",
                    "2x Upload limit (50 MB)",
                  ].map(f => (
                    <div key={f} className="nitro-plan-feature">
                      <span className="nitro-plan-feature-check">✓</span>
                      {f}
                    </div>
                  ))}
                </div>
                <button className="nitro-subscribe-btn" disabled>Subscribe (Beta = Free)</button>
              </div>

              <div className="nitro-plan nitro-plan--featured">
                <div className="nitro-plan-name">✨ Nitro</div>
                <div className="nitro-plan-price">$9.99</div>
                <div className="nitro-plan-period">/month · Most Popular</div>
                <div className="nitro-plan-features">
                  {[
                    "Everything in Basic",
                    "2 server boosts",
                    "500 MB upload limit",
                    "HD streaming (1080p 60fps)",
                    "Custom profile banner",
                    "Custom discriminator",
                  ].map(f => (
                    <div key={f} className="nitro-plan-feature">
                      <span className="nitro-plan-feature-check">✓</span>
                      {f}
                    </div>
                  ))}
                </div>
                <button className="nitro-subscribe-btn" disabled>Subscribe (Beta = Free)</button>
              </div>
            </div>

            <div style={{ marginTop: 32 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>What's included</div>
              <div className="nitro-features-grid">
                {NITRO_FEATURES.map(([icon, title, desc]) => (
                  <div key={title} className="nitro-feature-card">
                    <span className="nitro-feature-icon">{icon}</span>
                    <div>
                      <div className="nitro-feature-title">{title}</div>
                      <div className="nitro-feature-desc">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );

      case "Appearance":
        return (
          <>
            <div className="settings-title">Appearance</div>
            <div className="settings-section">
              <div className="settings-section-title">Theme</div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, background: "var(--bg-1)", border: "2px solid var(--blurple)", borderRadius: "var(--radius)", padding: 16, cursor: "pointer" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Dark</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>Recommended for low-light</div>
                </div>
                <div style={{ flex: 1, background: "#f2f3f5", border: "2px solid var(--border)", borderRadius: "var(--radius)", padding: 16, cursor: "not-allowed", opacity: 0.5 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#313338", marginBottom: 4 }}>Light</div>
                  <div style={{ fontSize: 12, color: "#4e5058" }}>Coming soon</div>
                </div>
              </div>
            </div>
            <div className="settings-section">
              <div className="settings-section-title">Message Display</div>
              <div style={{ color: "var(--text-3)", fontSize: 14 }}>Cozy mode (grouped messages) is active.</div>
            </div>
          </>
        );

      case "Privacy & Safety":
        return (
          <>
            <div className="settings-title">Privacy & Safety</div>
            <div className="settings-section">
              <div className="settings-section-title">Data & Privacy</div>
              <div style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.6 }}>
                Your data is stored in Cloudflare Durable Objects — no third-party tracking, no ads.
                Messages are stored per-channel and automatically pruned after 500 messages.
              </div>
            </div>
            <div className="settings-section">
              <div className="settings-section-title">Direct Messages</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Allow DMs from server members</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>Let people you share a server with send you DMs</div>
                </div>
                <div style={{ width: 40, height: 22, background: "var(--green)", borderRadius: 11, cursor: "pointer" }} />
              </div>
            </div>
          </>
        );

      case "Voice & Video":
        return (
          <>
            <div className="settings-title">Voice & Video</div>
            <div className="settings-section">
              <div className="settings-section-title">Voice Activity</div>
              <div style={{ color: "var(--text-3)", fontSize: 14, lineHeight: 1.6 }}>
                Voice channels use browser WebRTC. Microphone access is requested when you join a voice channel.
              </div>
            </div>
            <div className="settings-section">
              <div className="settings-section-title">Input Device</div>
              <div style={{ color: "var(--text-3)", fontSize: 14 }}>Using system default microphone.</div>
            </div>
          </>
        );

      case "Keybinds":
        return (
          <>
            <div className="settings-title">Keybinds</div>
            <div className="settings-section">
              <div className="settings-section-title">Chat</div>
              {[
                ["Enter",       "Send message"],
                ["Shift+Enter", "New line in message"],
                ["Escape",      "Close settings / dismiss"],
              ].map(([k, v]) => (
                <div key={k} className="settings-row">
                  <span className="settings-row-label">{v}</span>
                  <span style={{ padding: "2px 8px", background: "var(--bg-4)", borderRadius: 4, fontSize: 12, fontFamily: "var(--mono)" }}>{k}</span>
                </div>
              ))}
            </div>
          </>
        );

      default:
        return (
          <>
            <div className="settings-title">{active}</div>
            <div style={{ color: "var(--text-3)", fontSize: 14 }}>This section is coming soon.</div>
          </>
        );
    }
  };

  const navGroup = (label: string, items: Section[]) => (
    <div key={label} style={{ marginBottom: 8 }}>
      <div className="settings-group-label">{label}</div>
      {items.map(item => (
        <div
          key={item}
          className={`settings-item ${active === item ? "settings-item--active" : ""}`}
          onClick={() => setActive(item)}
        >
          {item}
        </div>
      ))}
    </div>
  );

  return (
    <div className="settings-overlay">
      <div className="settings-sidebar">
        {navGroup("User Settings", ["My Account", "Profile", "Privacy & Safety", "Authorized Apps", "Connections"])}
        {navGroup("Nitro", ["Nitro", "Server Boost", "Gift Inventory"])}
        {navGroup("App Settings", ["Appearance", "Accessibility", "Voice & Video", "Text & Images", "Notifications", "Keybinds", "Language"])}

        <div className="settings-sep" />
        <div
          className="settings-item settings-item--danger"
          onClick={() => { logout(); onClose(); }}
        >
          Log Out
        </div>

        <div className="settings-close-hint" onClick={onClose} style={{ cursor: "pointer" }}>
          <span>Close</span>
          <span className="settings-close-esc">ESC</span>
        </div>
      </div>

      <div className="settings-content">
        {renderContent()}
      </div>

      {/* Click outside to close */}
      <div
        style={{ position: "absolute", inset: 0, zIndex: -1 }}
        onClick={onClose}
      />
    </div>
  );
}
