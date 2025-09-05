// Centralized API base URL for the Spring Boot backend
// Configure via NEXT_PUBLIC_BACKEND_URL; defaults to http://localhost:8080
const base = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");

export const API_BASE = base;

export const apiUrl = (path: string) => `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

export default API_BASE;
