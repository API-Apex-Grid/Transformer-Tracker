import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const res = await fetch(apiUrl(`/api/profile?username=${encodeURIComponent(username)}`), {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: "Failed to get profile", details: text || undefined }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Profile fetch failed" }, { status: 500 });
  }
}