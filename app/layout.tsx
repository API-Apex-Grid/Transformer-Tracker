import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TransformersProvider } from "@/context/TransformersContext";
import { InspectionsProvider } from "@/context/InspectionsContext";
import Sidebar from "@/components/SideBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-black`}>
        <TransformersProvider>
          <InspectionsProvider>
            <Sidebar>{children}</Sidebar>
          </InspectionsProvider>
        </TransformersProvider>
      </body>
    </html>
  );
}
