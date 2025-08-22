import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Always serve fresh data from the DB
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const items = await prisma.transformer.findMany({ orderBy: { transformerNumber: "asc" } });
  return NextResponse.json(items, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const data = await req.json();
  const created = await prisma.transformer.create({ data });
  return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
}
