import React, { useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { uploadFile } from "./api";

interface Props { onClose: () => void; }

const SECTIONS = ["My Account", "Profile", "🚀 Nitro", "Appearance", "Privacy & Safety"];
const BANNER_COLORS = ["#5865f2","#57f287","#fee75c","#eb459e","#ed4245","#ff73fa","#f47fff","#3ba55d"];

export function SettingsPage({ onClose }: Props) {
  const { user, logout, updateProfile } = useAuth();
  const [active, setActive] = useState("My Account");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [bannerColor, setBannerColor] = useState(user?.bannerColor ?? "#5865f2");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setSaving(true);
    await updateProfile({ displayName, bio, bannerColor });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "avatar");
    await updateProfile({ avatarUrl: url });
  };

  return (
    <div className="settings-overlay">
      <div className="settings-sidebar">
        <div className="settings-section-label">User Settings</div>
        {SECTIONS.map(s => (
          <div key={s} className={`settings-item ${active===s?"active":""}`} onClick={() => setActive(s)}>{s}</div>
        ))}
        <div className="divider" />
        <div className="settings-item" style={{ color: "var(--red)" }} onClick={logout}>Log Out</div>
        <div className="settings-close" onClick={onClose}>
          <span style={{ fontSize: 20 }}>✕</span>
          <span>ESC</span>
        </div>
      </div>

      <div className="settings-main">
        {active === "My Account" && (
          <>
            <div className="settings-title">My Account</div>
            <div className="settings-section">
              <div className="settings-avatar-row">
                <div className="settings-avatar" onClick={() => fileRef.current?.click()}>
                  {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" /> : user?.displayName[0]?.toUpperCase()}
                  <div className="settings-avatar-overlay">📷</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.displayName}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>@{user?.username}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {user?.isNitro
                      ? <span className="tag tag-nitro">✨ Nitro</span>
                      : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Free</span>
                    }
                  </div>
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatar} />

              <div className="settings-row">
                <span className="settings-label">Username</span>
                <span className="settings-value">@{user?.username}</span>
              </div>
              <div className="settings-row">
                <span className="settings-label">User ID</span>
                <span className="settings-value" style={{ fontSize: 11 }}>{user?.userId}</span>
              </div>
              <div className="settings-row">
                <span className="settings-label">Member Since</span>
                <span className="settings-value">{new Date(user?.createdAt ?? 0).toLocaleDateString()}</span>
              </div>
            </div>
          </>
        )}

        {active === "Profile" && (
          <>
            <div className="settings-title">User Profile</div>

            <div className="settings-section">
              <div className="settings-section-title">Display Name</div>
              <input className="field-input" style={{ width: "100%" }} value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={32} placeholder="Display name" />
            </div>

            <div className="settings-section">
              <div className="settings-section-title">About Me</div>
              <textarea className="field-input" style={{ width:"100%", minHeight:100, borderRadius:4, padding:"10px 12px" }}
                value={bio} onChange={e=>setBio(e.target.value)} maxLength={190} placeholder="Tell us about yourself" />
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{bio.length}/190</div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Banner Color</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {BANNER_COLORS.map(c => (
                  <div key={c}
                    style={{ width:36, height:36, borderRadius:4, background:c, cursor:"pointer", border: bannerColor===c ? "3px solid white" : "3px solid transparent" }}
                    onClick={() => setBannerColor(c)} />
                ))}
              </div>
            </div>

            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saved ? "✓ Saved" : saving ? "Saving..." : "Save Changes"}
            </button>
          </>
        )}

        {active === "🚀 Nitro" && (
          <>
            <div className="settings-title">Nitro</div>
            <p style={{ color:"var(--text-muted)", fontSize:14, marginBottom:24 }}>
              All Nitro features are free during our beta. Enjoy everything — some features may become paid in the future.
            </p>

            <div className="nitro-section">
              <div className="nitro-badge-label">✨ Nitro — Free Beta</div>
              <div className="nitro-title">Supercharge your account</div>
              <div className="nitro-desc">Enjoy enhanced features that make your experience even better.</div>
              <div className="nitro-features">
                {[
                  ["🖼️","Animated Avatars","Upload GIF avatars"],
                  ["📁","Large File Uploads","Up to 500MB per upload"],
                  ["🎨","Custom Themes","Server color themes"],
                  ["😀","Custom Emojis","Per-server custom emojis"],
                  ["🚀","Server Boosts","Boost servers you love"],
                  ["🎖️","Profile Badges","Show off your support"],
                  ["📺","HD Streaming","1080p voice video"],
                  ["✏️","Profile Banner","Custom banner image"],
                ].map(([icon, name, desc]) => (
                  <div key={name} className="nitro-feature">{icon} <div><div style={{fontWeight:600}}>{name}</div><div style={{fontSize:11,opacity:.7}}>{desc}</div></div></div>
                ))}
              </div>
            </div>
          </>
        )}

        {active === "Appearance" && (
          <>
            <div className="settings-title">Appearance</div>
            <p style={{ color:"var(--text-muted)", fontSize:14 }}>Dark theme is active. More themes coming soon.</p>
          </>
        )}

        {active === "Privacy & Safety" && (
          <>
            <div className="settings-title">Privacy & Safety</div>
            <p style={{ color:"var(--text-muted)", fontSize:14 }}>Your data stays in your Cloudflare Durable Objects. No third-party tracking.</p>
          </>
        )}
      </div>
    </div>
  );
}
