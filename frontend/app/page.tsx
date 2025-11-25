"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";
import ThemeToggle from "@/components/ThemeToggle";
import { storeClientSession } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      setLoading(true);
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid credentials");
        return;
      }
      // Mark logged-in for simple client gating; also store username and image
      const data = await res.json();
      storeClientSession(
        {
          username: data.username,
          image: data.image,
          token: data.token,
          expiresIn: data.expiresIn,
          role: data.role,
        },
        username
      );
      router.push("/transformer");
    } catch {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-gray-900 transition-colors ">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-lg shadow p-6 transition-colors signin">
        <h1 className="text-xl font-semibold mb-4 text-center">Sign in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-1"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:ring-black"
              placeholder="Enter username"
              autoComplete="username"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:ring-black"
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full inline-flex justify-center rounded-md bg-black px-4 py-2 text-white font-medium transition-colors hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 dark:bg-white dark:text-black dark:hover:bg-white/80 dark:focus:ring-white"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
      <LoadingScreen show={loading} message="Signing you in…" />
    </div>
  );
}
