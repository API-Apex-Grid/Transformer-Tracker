"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl, authHeaders } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function ProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [hasPickedImage, setHasPickedImage] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loggedIn =
      typeof window !== "undefined" &&
      localStorage.getItem("isLoggedIn") === "true";
    if (!loggedIn) {
      router.replace("/");
      return;
    }
    const u =
      typeof window !== "undefined" ? localStorage.getItem("username") : null;
    setUsername(u);
    const storedRole =
      typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
    setUserRole(storedRole);
    fetch(apiUrl("/api/profile"), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (data?.username) {
          setUsername(data.username);
          try {
            localStorage.setItem("username", data.username);
          } catch {}
        }
        setImage(data?.image || null);
      })
      .catch(() => {});
  }, [router]);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImage(dataUrl);
      setHasPickedImage(true);
    };
    reader.readAsDataURL(file);
  };

  const saveImage = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/profile/image"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ image }),
      });
      if (!res.ok) throw new Error("Failed to save image");
      setMessage("Profile image saved");
      // Update localStorage so the profile picture shows up immediately in the header
      try {
        localStorage.setItem("userImage", image || "");
      } catch {}
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to save image");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/profile/password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to change password");
      }
      setMessage("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Your Profile</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 border">
          <Image
            src={image || "/avatar.png"}
            alt="Profile picture"
            width={64}
            height={64}
            loading="lazy"
            unoptimized={!!image && image.startsWith("data:")}
            className="object-cover w-16 h-16"
          />
        </div>
        <div>
          <div className="text-gray-700 dark:text-gray-300 text-sm">
            Logged in as
          </div>
          <div className="font-medium">
            {username}
            {userRole && <span className="font-normal"> ({userRole})</span>}
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">
            Change profile picture
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={onPickImage}
            className={`customfile border rounded px-3 py-2 ${
              hasPickedImage ? "text-black dark:text-white" : "text-gray-400"
            }`}
          />
          <button
            onClick={saveImage}
            disabled={saving}
            className="ml-3 inline-flex items-center rounded-md custombutton px-4 py-2"
          >
            Save image
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="block text-sm font-medium mb-1">
            Current password
          </span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="px-3 py-2 border rounded-md w-full"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="px-3 py-2 border rounded-md w-full"
          />
        </label>
        <button
          onClick={changePassword}
          disabled={saving}
          className="inline-flex items-center rounded-md px-4 py-2 custombutton"
        >
          Update password
        </button>
      </div>

      {message && (
        <p
          className={`mt-4 text-sm ${
            message.includes("incorrect") || message.includes("Failed")
              ? "text-red-600 dark:text-red-400"
              : "text-gray-700 dark:text-gray-300"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
