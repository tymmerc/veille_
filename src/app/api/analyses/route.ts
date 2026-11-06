import { NextResponse } from "next/server";
import { isAdminSession, listWeeks } from "@/lib/analyses";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  return NextResponse.json({ weeks: await listWeeks() });
}
