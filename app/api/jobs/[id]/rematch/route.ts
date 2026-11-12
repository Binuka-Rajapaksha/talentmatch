import { NextResponse } from "next/server";
import { matchSingleJob, exportTop10Csv } from "@/scripts/match";

export const maxDuration = 60; // Allow up to 60s on Vercel Hobby tier

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    await matchSingleJob(id);

    // Update local CSV when running locally
    try {
      await exportTop10Csv();
    } catch {
      // Ignore read-only fs warning in cloud deployment
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Matching failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}