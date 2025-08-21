"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import React, { useEffect, useState } from "react";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const checkLoginStatus = () => {
    try {
      const loggedIn =
        typeof window !== "undefined" &&
        localStorage.getItem("isLoggedIn") === "true";
      setIsLoggedIn(loggedIn);
      if (!loggedIn) router.replace("/");
    } catch {
      setIsLoggedIn(false);
      router.replace("/");
    }
  };

  useEffect(() => {
    checkLoginStatus();

    const onFocus = () => checkLoginStatus();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname, router]);

  if (isLoggedIn === null) return null;
  if (!isLoggedIn) return null;

  return (
    <div className="flex">
      <div
        className={`bg-gray-800 text-white fixed h-screen transition-all duration-300 z-10 ${
          isOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex flex-col items-start px-4 py-6 space-y-3">
          <Link
            href="/transformer"
            className="text-white hover:text-gray-300"
            onClick={() => setIsOpen(false)}
          >
            Transformers
          </Link>
          <Link
            href="/inspections"
            className="text-white hover:text-gray-300 pl-4"
            onClick={() => setIsOpen(false)}
          >
            Inspections
          </Link>
        </div>
      </div>

      <div className={`flex-1 p-4 ${isOpen ? "ml-64" : "ml-0"}`}>
        <div className="ml-auto">
          <button
            className="bg-black hover:bg-black/80 text-white font-bold p-2 rounded"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label="Toggle menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6"
            >
              <path d="M3 6.75h18v1.5H3zM3 11.25h18v1.5H3zM3 15.75h18v1.5H3z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
