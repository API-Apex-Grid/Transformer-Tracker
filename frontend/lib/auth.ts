export type LoginSessionPayload = {
  username?: string | null;
  image?: string | null;
  token?: string | null;
  expiresIn?: number | null;
  role?: string | null;
};

export const isClientLoggedIn = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("isLoggedIn") === "true";
  } catch {
    return false;
  }
};

export const storeClientSession = (payload: LoginSessionPayload, fallbackUsername?: string) => {
  if (typeof window === "undefined") return;
  try {
    const username = payload.username || fallbackUsername || "";
    const image = payload.image || "";
    const token = payload.token || "";
    const role = payload.role || "";
    const expiresIn = typeof payload.expiresIn === "number" && Number.isFinite(payload.expiresIn)
      ? Math.max(0, Math.floor(payload.expiresIn))
      : null;

    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("username", username);
    localStorage.setItem("userImage", image);
    localStorage.setItem("userRole", role);
    if (token) {
      localStorage.setItem("token", token);
    }
    if (expiresIn !== null) {
      const expiresAt = Date.now() + expiresIn * 1000;
      localStorage.setItem("tokenExpiresAt", String(expiresAt));
    } else {
      localStorage.removeItem("tokenExpiresAt");
    }
    window.dispatchEvent(new Event("app:logged-in"));
  } catch (err) {
    console.error("Failed to persist client session", err);
  }
};

export const clearClientSession = async () => {
  try {
    await fetch("/api/logout", { method: "POST", cache: "no-store", credentials: "same-origin" });
  } catch (err) {
    console.warn("Failed to call logout endpoint", err);
  }
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("username");
    localStorage.removeItem("userImage");
    localStorage.removeItem("userRole");
    localStorage.removeItem("token");
    localStorage.removeItem("tokenExpiresAt");
    window.dispatchEvent(new Event("app:logged-out"));
  } catch (err) {
    console.error("Failed to clear client session", err);
  }
};
