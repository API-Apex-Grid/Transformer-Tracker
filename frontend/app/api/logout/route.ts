import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  const baseOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  response.cookies.set("tt_logged_in", "", { ...baseOptions, maxAge: 0 });
  response.cookies.set("tt_token", "", { ...baseOptions, maxAge: 0 });
  return response;
}
