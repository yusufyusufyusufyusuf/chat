import React, { useRef, useState } from "react";
import { useAuth } from "./AuthContext";

interface Props {
  onClose: () => void;
}

export function ProfileEditor({ onClose }: Props) {
  const { user, updateAvatar, logout } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB.");
      return;
    }

    // Show preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setError(null);
    setUploading(true);

    try {
      await updateAvatar(file);
    } catch {
      setError("Upload failed. Try again.");
      setPreview(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const avatarSrc = preview ?? user?.avatarUrl ?? null;
  const initial = user?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-card" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <span className="profile-title">Profile</span>
          <button className="profile-close" onClick={onClose}>✕</button>
        </div>

        {/* Avatar */}
        <div className="profile-avatar-wrap">
          <div
            className="profile-avatar"
            onClick={() => fileRef.current?.click()}
            title="Click to upload a photo"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" className="profile-avatar-img" />
            ) : (
              <span className="profile-avatar-initial">{initial}</span>
            )}
            <div className="profile-avatar-overlay">
              {uploading ? (
                <span className="upload-spinner">⏳</span>
              ) : (
                <span className="upload-icon">📷</span>
              )}
            </div>
          </div>
          <p className="profile-avatar-hint">
            {uploading ? "Uploading…" : "Click to change photo"}
          </p>
          {error && <p className="profile-error">{error}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>

        {/* Username (display only — can't change after registration) */}
        <div className="profile-row">
          <span className="profile-label">Username</span>
          <span className="profile-value">{user?.username}</span>
        </div>

        <div className="profile-divider" />

        <button className="logout-btn" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
