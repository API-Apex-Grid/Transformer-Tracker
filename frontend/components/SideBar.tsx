"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import React, { useEffect, useState } from "react";

type Props = {
  children?: React.ReactNode;
};

const Sidebar = ({ children }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const pathname = usePathname();

  const checkLoginStatus = () => {
    try {
      const loggedIn = typeof window !== "undefined" && localStorage.getItem("isLoggedIn") === "true";
      setIsLoggedIn(!!loggedIn);
    } catch {
      setIsLoggedIn(false);
    }
  };

  useEffect(() => {
    checkLoginStatus();

    const onFocus = () => checkLoginStatus();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
      }
    };
  }, [pathname]);

  return (
    <div className="relative">
      {/* Sidebar (only rendered for logged-in users) */}
      {isLoggedIn && (
        <aside
          className={`bg-gray-800 text-white fixed h-screen transition-all duration-300 z-20 top-0 left-0 ${
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
              className="text-white hover:text-gray-300"
              onClick={() => setIsOpen(false)}
            >
              Inspections
            </Link>
          </div>
        </aside>
      )}

      {/* Toggle button (only for logged-in users) */}
      {isLoggedIn && (
        <button
          className="fixed top-4 left-4 bg-black hover:bg-black/80 text-white font-bold p-2 rounded z-30"
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
      )}

      {/* Page content */}
      <div className={isLoggedIn && isOpen ? "ml-64 transition-all duration-300" : "ml-0"}>
        {children}
      </div>
    </div>
  );
};

export default Sidebar;
