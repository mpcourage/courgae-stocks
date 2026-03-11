import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR  = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "screeners.json");

function readScreeners(): unknown[] {
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeScreeners(screeners: unknown[]) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(screeners), "utf-8");
}

export async function GET() {
  return NextResponse.json(readScreeners());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected array" }, { status: 400 });
  }
  writeScreeners(body);
  return NextResponse.json({ ok: true });
}
