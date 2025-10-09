"use client";

import React from "react";

interface LoadingScreenProps {
  show: boolean;
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  show,
  message = "Signing you in…",
}) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-6 shadow-2xl">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent"
          aria-hidden="true"
        />
        <p className="text-gray-700 font-medium" aria-live="polite">
          {message}
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
