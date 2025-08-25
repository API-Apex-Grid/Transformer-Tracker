import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Always serve fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fav = searchParams.get("fav");
  const where: any = {};
  if (fav === "true") where.favourite = true;
  const items = await prisma.inspection.findMany({ where: Object.keys(where).length ? where : undefined, orderBy: { inspectedDate: "desc" } });
  return NextResponse.json(items, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const data = await req.json();
  // Ensure the referenced transformer exists
  const tfNumber: string | undefined = data?.transformerNumber;
  if (!tfNumber) {
    return NextResponse.json({ error: "transformerNumber is required" }, { status: 400 });
  }
  const transformer = await prisma.transformer.findFirst({ where: { transformerNumber: tfNumber } });
  if (!transformer) {
    return NextResponse.json({ error: "Transformer not found for the given transformerNumber" }, { status: 400 });
  }

  const created = await prisma.inspection.create({ data });
  return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
}
