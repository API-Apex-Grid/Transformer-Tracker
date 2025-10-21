// Prefer env, fallback to local; ensure protocol is present.
const raw = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").trim().replace(/\/$/, "");
export const API_BASE = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `http://${raw}`;

export const apiUrl = (path: string) => `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

export default API_BASE;
