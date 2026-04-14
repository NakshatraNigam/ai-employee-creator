import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  buildSystemPrompt,
  compileRuntimeAgentConfig,
  type RuntimeTrigger,
} from "@/lib/agent-runtime/compile";
import { createEmbedding, generateChatResponse } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RunRequestBody = {
  configId?: string;
  input?: string;
  triggerType?: RuntimeTrigger;
  sessionId?: string;
};

type MemoryRow = {
  role: "user" | "assistant" | "system";
  content: string;
};

function isChatMemory(
  message: MemoryRow,
): message is {
  role: "user" | "assistant";
  content: string;
} {
  return message.role === "user" || message.role === "assistant";
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

function extractBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
}

function embeddingToVectorString(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

function normalizeTrigger(value: string | undefined): RuntimeTrigger {
  if (value === "chat" || value === "webhook" || value === "cron" || value === "chain") {
    return value;
  }

  return "chat";
}

export async function POST(request: Request) {
  let runId: string | null = null;

  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    if (!hasOpenAi && !hasGemini) {
      return NextResponse.json(
        { error: "Set OPENAI_API_KEY or GEMINI_API_KEY to run workflows." },
        { status: 500 },
      );
    }

    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as RunRequestBody;
    const configId = body.configId?.trim();
    const input = body.input?.trim();
    const triggerType = normalizeTrigger(body.triggerType);
    const sessionId = body.sessionId?.trim() || "default";

    if (!configId) {
      return NextResponse.json({ error: "configId is required." }, { status: 400 });
    }

    if (!input) {
      return NextResponse.json({ error: "input is required." }, { status: 400 });
    }

    const { data: configRow, error: configError } = await supabase
      .from("employee_configs")
      .select("id,config")
      .eq("id", configId)
      .single();

    if (configError || !configRow) {
      return NextResponse.json({ error: "Agent config not found." }, { status: 404 });
    }

    const runtimeConfig = compileRuntimeAgentConfig(configRow.config);
    if (!runtimeConfig.triggers.includes(triggerType)) {
      return NextResponse.json(
        {
          error: `Trigger '${triggerType}' is not configured for this agent.`,
          configuredTriggers: runtimeConfig.triggers,
        },
        { status: 400 },
      );
    }

    const { data: runRow, error: runInsertError } = await supabase
      .from("workflow_runs")
      .insert({
        user_id: user.id,
        agent_config_id: configId,
        trigger_type: triggerType,
        status: "running",
        input: {
          text: input,
          sessionId,
        },
      })
      .select("id")
      .single();

    if (runInsertError || !runRow) {
      return NextResponse.json(
        { error: runInsertError?.message ?? "Failed to create workflow run." },
        { status: 500 },
      );
    }

    runId = runRow.id as string;

    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await createEmbedding(input);
    } catch (err) {
      console.error("Embedding creation failed:", err);
      throw new Error(`Knowledge lookup failed (embedding error): ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    let knowledgeMatches: Array<{ content: string; similarity: number }> = [];
    if (queryEmbedding.length > 0) {
      try {
        const { data: chunkMatches, error: matchError } = await supabase.rpc("match_knowledge_chunks", {
          query_embedding: embeddingToVectorString(queryEmbedding),
          match_count: 6,
          filter_agent_config_id: configId,
        });

        if (matchError) throw matchError;

        if (Array.isArray(chunkMatches)) {
          knowledgeMatches = chunkMatches
            .map((row) => ({
              content: typeof row.content === "string" ? row.content : "",
              similarity: typeof row.similarity === "number" ? row.similarity : 0,
            }))
            .filter((row) => row.content.length > 0);
        }
      } catch (err) {
        console.error("Knowledge retrieval failed:", err);
        throw new Error(`Knowledge lookup failed (DB error): ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    const memorySessionId = runtimeConfig.memory === "permanent" ? "permanent" : sessionId;
    let memoryRows: MemoryRow[] = [];
    if (runtimeConfig.memory !== "none") {
      const { data } = await supabase
        .from("agent_memories")
        .select("role,content")
        .eq("agent_config_id", configId)
        .eq("session_id", memorySessionId)
        .order("created_at", { ascending: false })
        .limit(12);

      memoryRows = (data ?? []) as MemoryRow[];
      memoryRows = memoryRows.reverse();
    }

    const systemPrompt = buildSystemPrompt(
      runtimeConfig,
      knowledgeMatches.slice(0, 4).map((chunk) => chunk.content),
    );

    const generation = await generateChatResponse({
      requestedModel: runtimeConfig.requestedModel,
      systemPrompt,
      messages: [
        ...memoryRows
          .filter(isChatMemory)
          .map((message) => ({
            role: message.role,
            content: message.content,
          })),
        { role: "user", content: input },
      ],
    });
    const assistantText = generation.text;

    if (runtimeConfig.memory !== "none") {
      await supabase.from("agent_memories").insert([
        {
          user_id: user.id,
          agent_config_id: configId,
          session_id: memorySessionId,
          role: "user",
          content: input,
          metadata: { runId },
        },
        {
          user_id: user.id,
          agent_config_id: configId,
          session_id: memorySessionId,
          role: "assistant",
          content: assistantText,
          metadata: { runId },
        },
      ]);
    }

    const outputsTriggered = runtimeConfig.outputs.length > 0 ? runtimeConfig.outputs : ["chat-widget"];
    const warnings: string[] = generation.warnings;

    await supabase
      .from("workflow_runs")
      .update({
        status: "completed",
        output: {
          text: assistantText,
          outputsTriggered,
          warnings,
          knowledgeMatchesUsed: knowledgeMatches.length,
          modelRequested: runtimeConfig.requestedModel,
          modelUsed: generation.modelUsed,
          provider: generation.provider,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return NextResponse.json({
      runId,
      response: assistantText,
      outputsTriggered,
      warnings,
      modelRequested: runtimeConfig.requestedModel,
      modelUsed: generation.modelUsed,
      provider: generation.provider,
      knowledgeMatchesUsed: knowledgeMatches.length,
      memorySessionId: runtimeConfig.memory === "none" ? null : memorySessionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected run error.";

    if (runId) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const token = extractBearerToken(request.headers.get("authorization"));

        if (supabaseUrl && supabaseAnonKey && token) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          });

          await supabase
            .from("workflow_runs")
            .update({
              status: "failed",
              error: message,
              completed_at: new Date().toISOString(),
            })
            .eq("id", runId);
        }
      } catch {
        // no-op error path
      }
    }

    return NextResponse.json({ error: message, runId }, { status: 500 });
  }
}
