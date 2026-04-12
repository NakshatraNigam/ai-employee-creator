import type { Edge, Node, XYPosition } from "@xyflow/react";

export const DRAG_TEMPLATE_MIME = "application/x-ai-employee-template";

export type LayerKind = "identity" | "brain" | "skill" | "trigger" | "output";

export type BrainModel = "gpt-4o" | "gemini-1.5-pro" | "claude-3-5-sonnet";
export type MemoryType = "none" | "session" | "permanent";

export type SkillType =
  | "Email"
  | "WhatsApp"
  | "Web Search"
  | "Google Sheets"
  | "Calendar"
  | "Webhook";

export type TriggerType = "cron" | "webhook" | "chat" | "chain";

export type OutputType = "chat-widget" | "whatsapp" | "email" | "slack" | "api-endpoint";

export interface IdentityConfig {
  name: string;
  role: string;
  formalTone: number;
  detailLevel: number;
}

export interface BrainConfig {
  model: BrainModel;
  memory: MemoryType;
  guardrails: string;
  knowledgeFiles: string[];
  knowledgeUrls: string[];
}

export interface SkillConfig {
  skill: SkillType;
  enabled: boolean;
  instruction: string;
}

export interface TriggerConfig {
  type: TriggerType;
  cron: string;
  webhookEvent: string;
  chainSource: string;
}

export interface OutputConfig {
  channel: OutputType;
  destination: string;
}

export interface NodeConfigMap {
  identity: IdentityConfig;
  brain: BrainConfig;
  skill: SkillConfig;
  trigger: TriggerConfig;
  output: OutputConfig;
}

export type AnyNodeConfig = NodeConfigMap[LayerKind];

export interface BuilderNodeData<K extends LayerKind = LayerKind> extends Record<string, unknown> {
  kind: K;
  title: string;
  subtitle: string;
  color: string;
  config: NodeConfigMap[K];
}

export type BuilderNode = Node<BuilderNodeData>;

export interface NodeTemplate<K extends LayerKind = LayerKind> {
  id: string;
  kind: K;
  title: string;
  subtitle: string;
  color: string;
  defaultConfig: NodeConfigMap[K];
}

export interface AgentConfigDocument {
  version: 1;
  name: string;
  role: string;
  status: "draft" | "active";
  nodes: BuilderNode[];
  edges: Edge[];
  updatedAt: string;
}

export interface EmployeeSummary {
  name: string;
  role: string;
  status: "Draft" | "Ready";
  model: BrainModel | "Not set";
  memory: MemoryType | "none";
  skills: SkillType[];
  outputs: OutputType[];
}

export interface ReadinessCheck {
  key: string;
  label: string;
  done: boolean;
  hint: string;
}

export interface BuildReadiness {
  score: number;
  completed: number;
  total: number;
  nextAction: string;
  checks: ReadinessCheck[];
}

export function createNodeId(kind: LayerKind) {
  return `${kind}-${crypto.randomUUID()}`;
}

export function toNodeSubtitle(kind: LayerKind, config: AnyNodeConfig) {
  switch (kind) {
    case "identity": {
      const identity = config as IdentityConfig;
      return identity.role || "Role not set";
    }
    case "brain": {
      const brain = config as BrainConfig;
      return `${brain.model} - ${brain.memory}`;
    }
    case "skill": {
      const skill = config as SkillConfig;
      return skill.enabled ? skill.skill : `${skill.skill} (off)`;
    }
    case "trigger": {
      const trigger = config as TriggerConfig;
      return trigger.type === "cron"
        ? `Schedule: ${trigger.cron}`
        : trigger.type === "webhook"
          ? `Webhook: ${trigger.webhookEvent || "event"}`
          : trigger.type === "chat"
            ? "On-demand chat"
            : `Chained: ${trigger.chainSource || "upstream"}`;
    }
    case "output": {
      const output = config as OutputConfig;
      return output.destination ? `${output.channel} - ${output.destination}` : output.channel;
    }
    default:
      return "";
  }
}

export function createBuilderNode<K extends LayerKind>(
  template: NodeTemplate<K>,
  position: XYPosition,
): BuilderNode {
  const config = structuredClone(template.defaultConfig) as NodeConfigMap[K];

  return {
    id: createNodeId(template.kind),
    type: "builderNode",
    position,
    data: {
      kind: template.kind,
      title: template.title,
      subtitle: toNodeSubtitle(template.kind, config),
      color: template.color,
      config,
    },
  } as BuilderNode;
}

export function summarizeEmployee(nodes: BuilderNode[]): EmployeeSummary {
  const identityNode = nodes.find((node) => node.data.kind === "identity");
  const brainNode = nodes.find((node) => node.data.kind === "brain");

  const identity = (identityNode?.data.config as IdentityConfig | undefined) ?? {
    name: "Untitled Employee",
    role: "Unassigned",
    formalTone: 50,
    detailLevel: 50,
  };

  const brain = (brainNode?.data.config as BrainConfig | undefined) ?? {
    model: "gpt-4o",
    memory: "none",
    guardrails: "",
    knowledgeFiles: [],
    knowledgeUrls: [],
  };

  const skills = nodes
    .filter((node) => node.data.kind === "skill")
    .map((node) => node.data.config as SkillConfig)
    .filter((config) => config.enabled)
    .map((config) => config.skill);

  const outputs = nodes
    .filter((node) => node.data.kind === "output")
    .map((node) => (node.data.config as OutputConfig).channel);

  return {
    name: identity.name || "Untitled Employee",
    role: identity.role || "Unassigned",
    status: outputs.length > 0 && skills.length > 0 && brainNode ? "Ready" : "Draft",
    model: brainNode ? brain.model : "Not set",
    memory: brain.memory,
    skills,
    outputs,
  };
}

export function summarizeReadiness(nodes: BuilderNode[], edges: Edge[]): BuildReadiness {
  const identityNode = nodes.find((node) => node.data.kind === "identity");
  const brainNode = nodes.find((node) => node.data.kind === "brain");
  const triggerNode = nodes.find((node) => node.data.kind === "trigger");
  const skills = nodes.filter((node) => node.data.kind === "skill");
  const outputs = nodes.filter((node) => node.data.kind === "output");

  const identityConfig = identityNode?.data.config as IdentityConfig | undefined;
  const hasIdentityBasics = Boolean(identityConfig?.name?.trim()) && Boolean(identityConfig?.role?.trim());
  const hasBrain = Boolean(brainNode);
  const hasSkills = skills.some((node) => (node.data.config as SkillConfig).enabled);
  const hasTrigger = Boolean(triggerNode);
  const hasOutput = outputs.length > 0;
  const hasConnections = edges.length > 0;

  const checks: ReadinessCheck[] = [
    {
      key: "identity",
      label: "Identity configured",
      done: hasIdentityBasics,
      hint: "Set both a name and role in Identity.",
    },
    {
      key: "brain",
      label: "Brain configured",
      done: hasBrain,
      hint: "Add a Brain node and choose model/memory.",
    },
    {
      key: "skill",
      label: "At least one skill",
      done: hasSkills,
      hint: "Enable one skill node for task execution.",
    },
    {
      key: "trigger",
      label: "Trigger configured",
      done: hasTrigger,
      hint: "Add a Trigger node (chat, webhook, cron, or chain).",
    },
    {
      key: "output",
      label: "Output channel set",
      done: hasOutput,
      hint: "Add an Output node and destination.",
    },
    {
      key: "connections",
      label: "Node flow connected",
      done: hasConnections,
      hint: "Connect nodes so execution order is clear.",
    },
  ];

  const completed = checks.filter((check) => check.done).length;
  const total = checks.length;
  const score = Math.round((completed / total) * 100);
  const nextPending = checks.find((check) => !check.done);

  return {
    score,
    completed,
    total,
    nextAction: nextPending?.hint ?? "Your employee is production-ready.",
    checks,
  };
}

export function buildConfigDocument(nodes: BuilderNode[], edges: Edge[]): AgentConfigDocument {
  const summary = summarizeEmployee(nodes);

  return {
    version: 1,
    name: summary.name,
    role: summary.role,
    status: summary.status === "Ready" ? "active" : "draft",
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
}
