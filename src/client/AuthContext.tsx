import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { AuthUser } from "../shared/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
  updateAvatar: (file: File) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem("chat:token");
    if (!token) {
      setLoading(false);
      return;
    }
    fetch("/auth/verify", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setUser({ ...data, token });
        } else {
          localStorage.removeItem("chat:token");
        }
      })
      .catch(() => localStorage.removeItem("chat:token"))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<string | null> => {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json() as (AuthUser & { error?: string; token: string });
      if (!res.ok) return data.error ?? "Login failed";
      localStorage.setItem("chat:token", data.token);
      setUser(data);
      return null;
    },
    []
  );

  const register = useCallback(
    async (username: string, password: string): Promise<string | null> => {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json() as (AuthUser & { error?: string; token: string });
      if (!res.ok) return data.error ?? "Registration failed";
      localStorage.setItem("chat:token", data.token);
      setUser(data);
      return null;
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("chat:token");
    setUser(null);
  }, []);

  const updateAvatar = useCallback(
    async (file: File) => {
      if (!user) return;

      // Resize/compress to max 256x256 before upload
      const resized = await resizeImage(file, 256);

      const res = await fetch("/avatar", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": resized.type,
        },
        body: resized,
      });

      if (!res.ok) throw new Error("Upload failed");
      const { avatarUrl } = await res.json() as { avatarUrl: string };

      // Add cache-busting param so browser reloads the new image
      const bustedUrl = `${avatarUrl}?t=${Date.now()}`;
      setUser((u) => (u ? { ...u, avatarUrl: bustedUrl } : u));
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ── Image resize helper ───────────────────────────────────────────────────────

function resizeImage(file: File, maxPx: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas error"))),
        "image/jpeg",
        0.88
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}
