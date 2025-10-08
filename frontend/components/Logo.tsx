"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function Logo({ width = 36, height = 36, className = "" }: LogoProps) {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      try {
        const stored = localStorage.getItem("theme");
        const dark = stored === "dark" || document.documentElement.classList.contains("dark");
        setIsDark(dark);
      } catch {}
    };

    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains("dark");
      setIsDark(dark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Image
      src={isDark ? "/transformer_dark.png" : "/transformer.png"}
      alt="Apex Grid"
      width={width}
      height={height}
      className={className}
    />
  );
}
