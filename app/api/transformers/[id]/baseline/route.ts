import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// No filesystem writes; store image as base64 in DB

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

  const form = await req.formData();
    const file = form.get("file");
    const weather = (form.get("weather") as string) || "sunny";
  const uploader = req.headers.get('x-username') || null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

  const { id } = await params;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mime = (file as File).type || "application/octet-stream";
  const base64 = buffer.toString("base64");
  const imageUrl = `data:${mime};base64,${base64}`;

    // Map weather to column
  const now = new Date();
  const data: Record<string, string | Date | null> = {};
  if (weather === "sunny") {
    data.sunnyImage = imageUrl;
    data.sunnyImageUploadedBy = uploader;
    data.sunnyImageUploadedAt = now;
  } else if (weather === "cloudy") {
    data.cloudyImage = imageUrl;
    data.cloudyImageUploadedBy = uploader;
    data.cloudyImageUploadedAt = now;
  } else if (weather === "rainy") {
    data.windyImage = imageUrl;
    data.windyImageUploadedBy = uploader;
    data.windyImageUploadedAt = now;
  }

  const updated = await prisma.transformer.update({ where: { id }, data });
    return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
