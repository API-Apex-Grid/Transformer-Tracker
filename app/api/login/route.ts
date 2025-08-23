import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      // Dev convenience: allow first-time creation of user1..user5 with same password
      if (/^user[1-5]$/.test(username) && password === username) {
        const passwordHash = await bcrypt.hash(password, 10);
        user = await prisma.user.create({ data: { username, passwordHash } });
      } else {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }
    } else {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }
    }

    return NextResponse.json({ username }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
