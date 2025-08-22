import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Always serve fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const items = await prisma.inspection.findMany({ orderBy: { inspectedDate: "desc" } });
  return NextResponse.json(items, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const data = await req.json();
  const created = await prisma.inspection.create({ data });
  return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
}
