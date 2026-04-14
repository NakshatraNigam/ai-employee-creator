import OpenAI from "openai";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatGenerationInput {
  requestedModel: string;
  systemPrompt: string;
  messages: ChatMessage[];
}

export interface ChatGenerationResult {
  text: string;
  modelUsed: string;
  provider: "openai" | "gemini";
  warnings: string[];
}

function getEnv(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

function embeddingDimension() {
  const raw = getEnv("EMBEDDING_DIMENSION");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1536;
}

function resolveChatProvider(requestedModel: string) {
  const forced = (getEnv("CHAT_PROVIDER") ?? "").toLowerCase();
  if (forced === "gemini" || forced === "openai") {
    return forced as "gemini" | "openai";
  }

  if (requestedModel.startsWith("gemini")) {
    return "gemini";
  }

  if (requestedModel.startsWith("gpt")) {
    return "openai";
  }

  return getEnv("GEMINI_API_KEY") ? "gemini" : "openai";
}

function resolveChatModel(requestedModel: string, provider: "openai" | "gemini") {
  if (provider === "gemini") {
    const configured = getEnv("GEMINI_CHAT_MODEL");
    if (configured) {
      return configured;
    }
    return requestedModel.startsWith("gemini") ? requestedModel : "gemini-1.5-flash";
  }

  if (requestedModel === "gpt-4o") {
    return getEnv("OPENAI_CHAT_MODEL_GPT4O") ?? "gpt-4o";
  }

  return getEnv("OPENAI_CHAT_MODEL") ?? "gpt-4o-mini";
}

async function generateWithOpenAI(input: ChatGenerationInput, model: string): Promise<string> {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const openai = new OpenAI({ apiKey });
  const result = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: input.systemPrompt },
      ...input.messages.map((message) => ({ role: message.role, content: message.content })),
    ],
  });

  const content = result.choices[0]?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => ("text" in part ? part.text ?? "" : ""))
      .join("\n")
      .trim();
    if (text.length > 0) {
      return text;
    }
  }

  throw new Error("OpenAI returned an empty response.");
}

async function generateWithGemini(input: ChatGenerationInput, model: string): Promise<string> {
  const apiKey = getEnv("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents: input.messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          temperature: 0.2,
        },
      }),
    },
  );

  const payload = (await response.json()) as {
    error?: { message?: string };
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Gemini request failed.");
  }

  const text = (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

export async function generateChatResponse(input: ChatGenerationInput): Promise<ChatGenerationResult> {
  const warnings: string[] = [];
  const preferredProvider = resolveChatProvider(input.requestedModel);
  const preferredModel = resolveChatModel(input.requestedModel, preferredProvider);

  try {
    const text =
      preferredProvider === "gemini"
        ? await generateWithGemini(input, preferredModel)
        : await generateWithOpenAI(input, preferredModel);

    if (preferredModel !== input.requestedModel) {
      warnings.push(`Requested model '${input.requestedModel}' mapped to '${preferredModel}'.`);
    }

    return {
      text,
      modelUsed: preferredModel,
      provider: preferredProvider,
      warnings,
    };
  } catch (error) {
    const secondaryProvider = preferredProvider === "gemini" ? "openai" : "gemini";
    const secondaryModel = resolveChatModel(input.requestedModel, secondaryProvider);

    const initialReason = error instanceof Error ? error.message : "primary provider failed";
    warnings.push(
      `Primary provider '${preferredProvider}' failed (${initialReason}). Falling back to '${secondaryProvider}'.`,
    );

    const text =
      secondaryProvider === "gemini"
        ? await generateWithGemini(input, secondaryModel)
        : await generateWithOpenAI(input, secondaryModel);

    if (secondaryModel !== input.requestedModel) {
      warnings.push(`Requested model '${input.requestedModel}' mapped to '${secondaryModel}'.`);
    }

    return {
      text,
      modelUsed: secondaryModel,
      provider: secondaryProvider,
      warnings,
    };
  }
}

async function embedWithOpenAI(text: string): Promise<number[]> {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const openai = new OpenAI({ apiKey });
  const model = getEnv("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small";
  const result = await openai.embeddings.create({
    model,
    input: text,
  });

  const vector = result.data[0]?.embedding;
  if (!vector || vector.length === 0) {
    throw new Error("OpenAI embedding request returned no vector.");
  }

  return vector;
}

async function embedWithGemini(text: string): Promise<number[]> {
  const apiKey = getEnv("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const model = getEnv("GEMINI_EMBED_MODEL") ?? "gemini-embedding-001";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
        outputDimensionality: embeddingDimension(),
      }),
    },
  );

  const payload = (await response.json()) as {
    error?: { message?: string };
    embedding?: { values?: number[] };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Gemini embedding request failed.");
  }

  const vector = payload.embedding?.values ?? [];
  if (vector.length === 0) {
    throw new Error("Gemini embedding request returned no vector.");
  }

  return vector;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const providerPref = (getEnv("EMBEDDING_PROVIDER") ?? "").toLowerCase();

  if (providerPref === "gemini") {
    return embedWithGemini(text);
  }

  if (providerPref === "openai") {
    return embedWithOpenAI(text);
  }

  if (getEnv("GEMINI_API_KEY")) {
    try {
      return await embedWithGemini(text);
    } catch {
      return embedWithOpenAI(text);
    }
  }

  return embedWithOpenAI(text);
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const text of texts) {
    vectors.push(await createEmbedding(text));
  }

  return vectors;
}
