import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const envStatus = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "Present" : "Missing",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "Present" : "Missing",
    GEMINI_CHAT_MODEL: process.env.GEMINI_CHAT_MODEL ?? "Not Set (using default)",
    GEMINI_EMBED_MODEL: process.env.GEMINI_EMBED_MODEL ?? "Not Set (using default)",
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER ?? "Not Set (using fallback)",
    EMBEDDING_DIMENSION: process.env.EMBEDDING_DIMENSION ?? "Not Set (using 1536)",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Present" : "Missing",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Present" : "Missing",
  };

  const supabase = createRouteHandlerClient({ cookies });
  let supabaseStatus = "Unknown";
  let supabaseMessage = "";

  try {
    const { data, error } = await supabase.from("agent_configs").select("id").limit(1);
    if (error) {
      supabaseStatus = "Error";
      supabaseMessage = error.message;
    } else {
      supabaseStatus = "Connected";
    }
  } catch (err) {
    supabaseStatus = "Failed";
    supabaseMessage = err instanceof Error ? err.message : "Internal Error";
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: envStatus,
    supabase: {
      status: supabaseStatus,
      message: supabaseMessage,
    },
    recommendations: [
      "If EMBEDDING_PROVIDER is 'gemini', ensure GEMINI_EMBED_MODEL is 'text-embedding-004' for 1536-D support.",
      "Check Vercel Dashboard -> Settings -> Environment Variables to sync with .env.local.",
      "Redeploy after changing environment variables.",
    ]
  });
}
