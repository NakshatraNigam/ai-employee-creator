type UnknownRecord = Record<string, unknown>;

export type RuntimeTrigger = "chat" | "webhook" | "cron" | "chain";
export type RuntimeMemory = "none" | "session" | "permanent";

export interface RuntimeAgentConfig {
  name: string;
  role: string;
  formalTone: number;
  detailLevel: number;
  requestedModel: string;
  memory: RuntimeMemory;
  guardrails: string;
  skills: Array<{ name: string; instruction: string }>;
  triggers: RuntimeTrigger[];
  outputs: string[];
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeTrigger(value: unknown): RuntimeTrigger | null {
  if (value === "chat" || value === "webhook" || value === "cron" || value === "chain") {
    return value;
  }

  return null;
}

function normalizeMemory(value: unknown): RuntimeMemory {
  if (value === "none" || value === "session" || value === "permanent") {
    return value;
  }

  return "none";
}

export function compileRuntimeAgentConfig(document: unknown): RuntimeAgentConfig {
  const parsedDocument = asRecord(document);
  if (!parsedDocument) {
    throw new Error("Invalid config document.");
  }

  const nodes = Array.isArray(parsedDocument.nodes) ? parsedDocument.nodes : [];
  const typedNodes = nodes.map((node) => asRecord(node)).filter(Boolean) as UnknownRecord[];

  const identityNode = typedNodes.find((node) => asRecord(node.data)?.kind === "identity");
  const brainNode = typedNodes.find((node) => asRecord(node.data)?.kind === "brain");
  const skillNodes = typedNodes.filter((node) => asRecord(node.data)?.kind === "skill");
  const triggerNodes = typedNodes.filter((node) => asRecord(node.data)?.kind === "trigger");
  const outputNodes = typedNodes.filter((node) => asRecord(node.data)?.kind === "output");

  const identityConfig = asRecord(asRecord(identityNode?.data)?.config) ?? {};
  const brainConfig = asRecord(asRecord(brainNode?.data)?.config) ?? {};

  const skills = skillNodes
    .map((node) => asRecord(asRecord(node.data)?.config))
    .filter(Boolean)
    .filter((config) => asBoolean(config?.enabled, true))
    .map((config) => ({
      name: asString(config?.skill, "Skill"),
      instruction: asString(config?.instruction),
    }));

  const triggers = triggerNodes
    .map((node) => asRecord(asRecord(node.data)?.config))
    .filter(Boolean)
    .map((config) => normalizeTrigger(config?.type))
    .filter((trigger): trigger is RuntimeTrigger => Boolean(trigger));

  const outputs = outputNodes
    .map((node) => asRecord(asRecord(node.data)?.config))
    .filter(Boolean)
    .map((config) => asString(config?.channel))
    .filter(Boolean);

  return {
    name: asString(identityConfig.name, asString(parsedDocument.name, "Untitled Employee")),
    role: asString(identityConfig.role, asString(parsedDocument.role, "Unassigned")),
    formalTone: asNumber(identityConfig.formalTone, 50),
    detailLevel: asNumber(identityConfig.detailLevel, 50),
    requestedModel: asString(brainConfig.model, "gpt-4o"),
    memory: normalizeMemory(brainConfig.memory),
    guardrails: asString(brainConfig.guardrails),
    skills,
    triggers: triggers.length > 0 ? triggers : ["chat"],
    outputs,
  };
}

export function buildSystemPrompt(config: RuntimeAgentConfig, knowledgeContext: string[]) {
  const toneDirection = config.formalTone >= 50 ? "more formal than casual" : "more casual than formal";
  const detailDirection = config.detailLevel >= 50 ? "detailed responses" : "brief responses";

  const skillsSection =
    config.skills.length > 0
      ? config.skills.map((skill) => `- ${skill.name}: ${skill.instruction || "Use when relevant."}`).join("\n")
      : "- No tools configured.";

  const knowledgeSection =
    knowledgeContext.length > 0
      ? knowledgeContext.map((chunk, index) => `[Doc ${index + 1}] ${chunk}`).join("\n\n")
      : "No indexed knowledge found.";

  return [
    `You are ${config.name}, an autonomous AI employee.`,
    `Role: ${config.role}.`,
    `Communication style: ${toneDirection}; prefer ${detailDirection}.`,
    `Guardrails: ${config.guardrails || "Follow company-safe best practices and avoid harmful outputs."}`,
    "Configured skills:",
    skillsSection,
    "Knowledge context:",
    knowledgeSection,
    "When uncertain, state assumptions clearly and avoid fabricating facts.",
  ].join("\n\n");
}
