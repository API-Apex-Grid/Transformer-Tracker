import { NextResponse } from "next/server";

// Always serve fresh data (no caching)
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

export async function GET(req: Request) {
  const incomingUrl = new URL(req.url);
  const tf = incomingUrl.searchParams.get("tf");
  const fav = incomingUrl.searchParams.get("fav");

  const base = getBackendBaseUrl();
  const url = new URL(`${base}/api/transformers`);
  if (tf) url.searchParams.set("tf", tf);
  if (fav) url.searchParams.set("fav", fav);

  const res = await fetch(url.toString(), {
    cache: "no-store",
    // Forward auth header if present (supports JWT/Bearer flows)
    headers: {
      ...(req.headers.get("authorization")
        ? { authorization: req.headers.get("authorization") as string }
        : {}),
      "content-type": "application/json",
    },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Upstream error`, status: res.status },
      { status: res.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  const data = await res.json();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const base = getBackendBaseUrl();
  const url = `${base}/api/transformers`;
  const body = await req.json();

  const res = await fetch(url, {
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
      { error: `Upstream error`, details: text || undefined, status: res.status },
      { status: res.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  const data = await res.json();
  return NextResponse.json(data, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
