import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(apiUrl("/api/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: "Invalid credentials", details: text || undefined }, { status: res.status });
    }

    const data = await res.json();
    // Expecting backend to return at least { token, username }
    const response = NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });

    const secure = process.env.NODE_ENV === "production";
    const rawExpires = typeof data?.expiresIn === "number" && Number.isFinite(data.expiresIn)
      ? Math.floor(data.expiresIn)
      : null;
    const expiresInSeconds = rawExpires && rawExpires > 0 ? rawExpires : 60 * 60 * 12; // default 12h session

    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      path: "/",
      maxAge: expiresInSeconds,
    };

    response.cookies.set("tt_logged_in", "1", cookieOptions);
    if (typeof data?.token === "string" && data.token.length > 0) {
      response.cookies.set("tt_token", data.token, cookieOptions);
    }

    return response;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
