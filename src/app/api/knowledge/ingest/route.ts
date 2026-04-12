import { NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";

import { createEmbeddings } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SourcePayload = {
  sourceType: "file" | "url";
  sourceName: string;
  sourceUrl: string | null;
  content: string;
};

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const MAX_DOC_CHARS = 200_000;

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

function sanitizeText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function htmlToPlainText(html: string) {
  return sanitizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/?[^>]+(>|$)/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"'),
  );
}

function vectorToPg(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

async function fileToText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerFileName = file.name.toLowerCase();

  if (lowerFileName.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return sanitizeText(result.text);
    } finally {
      await parser.destroy();
    }
  }

  return sanitizeText(buffer.toString("utf-8"));
}

async function urlToText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "AIEmployeeCreatorKnowledgeBot/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch URL (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("text/html")) {
    return htmlToPlainText(body);
  }

  return sanitizeText(body);
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    if (!hasOpenAi && !hasGemini) {
      return NextResponse.json(
        { error: "Set OPENAI_API_KEY or GEMINI_API_KEY for embeddings." },
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

    const formData = await request.formData();
    const agentConfigIdRaw = formData.get("agentConfigId");
    const urlsRaw = formData.get("urls");
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    const agentConfigId =
      typeof agentConfigIdRaw === "string" && agentConfigIdRaw.length > 0 ? agentConfigIdRaw : null;

    let urls: string[] = [];
    if (typeof urlsRaw === "string") {
      try {
        urls = (JSON.parse(urlsRaw) as string[]).map((url) => url.trim()).filter(Boolean);
      } catch {
        return NextResponse.json({ error: "Invalid URL payload." }, { status: 400 });
      }
    }

    if (files.length === 0 && urls.length === 0) {
      return NextResponse.json({ error: "No files or URLs provided." }, { status: 400 });
    }

    const sources: SourcePayload[] = [];
    const failedSources: { source: string; error: string }[] = [];

    for (const file of files) {
      try {
        const text = await fileToText(file);
        if (!text) {
          failedSources.push({ source: file.name, error: "No text extracted." });
          continue;
        }

        sources.push({
          sourceType: "file",
          sourceName: file.name,
          sourceUrl: null,
          content: text.slice(0, MAX_DOC_CHARS),
        });
      } catch (error) {
        failedSources.push({
          source: file.name,
          error: error instanceof Error ? error.message : "Failed to parse file.",
        });
      }
    }

    for (const url of urls) {
      try {
        const text = await urlToText(url);
        if (!text) {
          failedSources.push({ source: url, error: "No text extracted." });
          continue;
        }

        sources.push({
          sourceType: "url",
          sourceName: url,
          sourceUrl: url,
          content: text.slice(0, MAX_DOC_CHARS),
        });
      } catch (error) {
        failedSources.push({
          source: url,
          error: error instanceof Error ? error.message : "Failed to fetch URL.",
        });
      }
    }

    if (sources.length === 0) {
      return NextResponse.json(
        { error: "No valid source text to ingest.", failedSources },
        { status: 400 },
      );
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });

    const indexedDocuments: {
      id: string;
      source_name: string;
      source_type: "file" | "url";
      chunk_count: number;
      created_at: string;
    }[] = [];

    let totalChunks = 0;

    for (const source of sources) {
      const chunks = await textSplitter.splitText(source.content);

      if (chunks.length === 0) {
        failedSources.push({ source: source.sourceName, error: "Chunking resulted in zero chunks." });
        continue;
      }

      const embeddingsResult = await createEmbeddings(chunks);

      const { data: documentRow, error: documentInsertError } = await supabase
        .from("knowledge_documents")
        .insert({
          user_id: user.id,
          agent_config_id: agentConfigId,
          source_type: source.sourceType,
          source_name: source.sourceName,
          source_url: source.sourceUrl,
          content_text: source.content,
          chunk_count: chunks.length,
          metadata: {
            originalChars: source.content.length,
            chunkSize: CHUNK_SIZE,
            chunkOverlap: CHUNK_OVERLAP,
          },
        })
        .select("id,source_name,source_type,chunk_count,created_at")
        .single();

      if (documentInsertError || !documentRow) {
        failedSources.push({
          source: source.sourceName,
          error: documentInsertError?.message ?? "Failed to create document row.",
        });
        continue;
      }

      const chunkRows = chunks.map((chunk, index) => ({
        user_id: user.id,
        document_id: documentRow.id,
        agent_config_id: agentConfigId,
        chunk_index: index,
        content: chunk,
        embedding: vectorToPg(embeddingsResult[index]),
        metadata: {
          sourceType: source.sourceType,
          sourceName: source.sourceName,
          sourceUrl: source.sourceUrl,
        },
      }));

      const { error: chunkInsertError } = await supabase.from("knowledge_chunks").insert(chunkRows);
      if (chunkInsertError) {
        await supabase.from("knowledge_documents").delete().eq("id", documentRow.id);
        failedSources.push({
          source: source.sourceName,
          error: chunkInsertError.message,
        });
        continue;
      }

      totalChunks += chunks.length;
      indexedDocuments.push(documentRow);
    }

    return NextResponse.json({
      indexedDocuments,
      processedCount: indexedDocuments.length,
      totalChunks,
      failedSources,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
