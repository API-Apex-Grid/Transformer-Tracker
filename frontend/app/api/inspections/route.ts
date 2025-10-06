import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/api";

// Always serve fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fav = searchParams.get("fav");
  const summary = searchParams.get("summary");

  const url = new URL(apiUrl("/api/inspections"));
  if (fav) url.searchParams.set("fav", fav);

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      ...(req.headers.get("authorization")
        ? { authorization: req.headers.get("authorization") as string }
        : {}),
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Upstream error", status: res.status },
      { status: res.status }
    );
  }
  const data = await res.json();
  if (summary) {
    const list = Array.isArray(data) ? data : [];
    const stripped = list.map((i) => {
      const { imageUrl, boundingBoxes, faultTypes, imageUploadedBy, imageUploadedAt, lastAnalysisWeather, transformer, ...rest } = i || {} as any;
      const transformerNumber = (rest as any).transformerNumber ?? (transformer?.transformerNumber ?? "");
      return { ...rest, transformerNumber };
    });
    return NextResponse.json(stripped, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(apiUrl("/api/inspections"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(req.headers.get("authorization")
        ? { authorization: req.headers.get("authorization") as string }
        : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "Upstream error", details: text || undefined },
      { status: res.status }
    );
  }
  const data = await res.json();
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "no-store" } });
}
