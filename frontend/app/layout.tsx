import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import { TransformersProvider } from "@/context/TransformersContext";
import { InspectionsProvider } from "@/context/InspectionsContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Apex Grid",
  description: "A platform for managing transformers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} antialiased bg-white text-black`}
      >
        {/* Initialize theme before UI paints to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark');document.body.classList.remove('bg-white','text-black');document.body.classList.add('bg-black','text-white');}}catch(e){}})();",
          }}
        />
        <TransformersProvider>
          <InspectionsProvider>{children}</InspectionsProvider>
        </TransformersProvider>
      </body>
    </html>
  );
}
