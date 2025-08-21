import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.inspection.findMany({ orderBy: { inspectedDate: "desc" } });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const data = await req.json();
  const created = await prisma.inspection.create({ data });
  return NextResponse.json(created, { status: 201 });
}
