import type {
  BrainConfig,
  IdentityConfig,
  NodeTemplate,
  OutputConfig,
  OutputType,
  SkillConfig,
  SkillType,
  TriggerConfig,
  TriggerType,
} from "@/lib/agent-builder/types";

export const SKILL_OPTIONS: SkillType[] = [
  "Email",
  "WhatsApp",
  "Web Search",
  "Google Sheets",
  "Calendar",
  "Webhook",
];

export const TRIGGER_OPTIONS: TriggerType[] = ["cron", "webhook", "chat", "chain"];

export const OUTPUT_OPTIONS: OutputType[] = [
  "chat-widget",
  "whatsapp",
  "email",
  "slack",
  "api-endpoint",
];

export const MODEL_OPTIONS = ["gpt-4o", "gemini-1.5-pro", "claude-3-5-sonnet"] as const;
export const MEMORY_OPTIONS = ["none", "session", "permanent"] as const;

export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    id: "identity",
    kind: "identity",
    title: "Identity",
    subtitle: "Name, role, personality",
    color: "#f97316",
    defaultConfig: {
      name: "",
      role: "",
      formalTone: 50,
      detailLevel: 50,
    },
  },
  {
    id: "brain",
    kind: "brain",
    title: "Brain",
    subtitle: "Model, memory, guardrails",
    color: "#0ea5e9",
    defaultConfig: {
      model: "gpt-4o",
      memory: "session",
      guardrails: "Avoid sharing sensitive data.",
      knowledgeFiles: [],
      knowledgeUrls: [],
    },
  },
  {
    id: "skill",
    kind: "skill",
    title: "Skill",
    subtitle: "Tooling and actions",
    color: "#16a34a",
    defaultConfig: {
      skill: "Email",
      enabled: true,
      instruction: "Draft polite customer updates and summaries.",
    },
  },
  {
    id: "trigger",
    kind: "trigger",
    title: "Trigger",
    subtitle: "When the employee runs",
    color: "#f59e0b",
    defaultConfig: {
      type: "chat",
      cron: "0 9 * * 1-5",
      webhookEvent: "lead_created",
      chainSource: "coordinator-agent",
    },
  },
  {
    id: "output",
    kind: "output",
    title: "Output",
    subtitle: "Where results are delivered",
    color: "#4f46e5",
    defaultConfig: {
      channel: "chat-widget",
      destination: "team-inbox",
    },
  },
];

export interface AgentBlueprint {
  id: string;
  name: string;
  description: string;
  seeds: Array<{
    templateId: NodeTemplate["id"];
    position: { x: number; y: number };
    configOverrides?: Partial<IdentityConfig | BrainConfig | SkillConfig | TriggerConfig | OutputConfig>;
  }>;
  edges: Array<[number, number]>;
}

export const AGENT_BLUEPRINTS: AgentBlueprint[] = [
  {
    id: "support-agent",
    name: "Support Specialist",
    description: "Fast customer issue triage with polite follow-ups and chat delivery.",
    seeds: [
      {
        templateId: "identity",
        position: { x: 40, y: 160 },
        configOverrides: {
          name: "Ava Assist",
          role: "Customer Support Specialist",
          formalTone: 65,
          detailLevel: 60,
        },
      },
      {
        templateId: "brain",
        position: { x: 360, y: 160 },
        configOverrides: {
          model: "gpt-4o",
          memory: "session",
          guardrails: "Never share sensitive account info. Escalate billing and legal matters.",
        },
      },
      {
        templateId: "skill",
        position: { x: 690, y: 70 },
        configOverrides: {
          skill: "Email",
          enabled: true,
          instruction: "Draft concise and empathetic customer emails with clear next steps.",
        },
      },
      {
        templateId: "skill",
        position: { x: 690, y: 250 },
        configOverrides: {
          skill: "Web Search",
          enabled: true,
          instruction: "Find relevant troubleshooting docs and summarize trusted sources only.",
        },
      },
      {
        templateId: "trigger",
        position: { x: 1020, y: 80 },
        configOverrides: { type: "chat" },
      },
      {
        templateId: "output",
        position: { x: 1020, y: 250 },
        configOverrides: { channel: "chat-widget", destination: "support_widget_v1" },
      },
    ],
    edges: [
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 5],
      [3, 5],
      [4, 1],
    ],
  },
  {
    id: "sales-qualifier",
    name: "Sales Qualifier",
    description: "Lead enrichment + routing into CRM and inbox summaries.",
    seeds: [
      {
        templateId: "identity",
        position: { x: 40, y: 160 },
        configOverrides: {
          name: "Leo SalesOps",
          role: "Inbound Sales Qualifier",
          formalTone: 55,
          detailLevel: 50,
        },
      },
      {
        templateId: "brain",
        position: { x: 360, y: 160 },
        configOverrides: {
          model: "gpt-4o",
          memory: "session",
          guardrails: "Do not fabricate company facts. Ask follow-up questions when lead data is missing.",
        },
      },
      {
        templateId: "skill",
        position: { x: 690, y: 70 },
        configOverrides: {
          skill: "Google Sheets",
          enabled: true,
          instruction: "Append qualified lead summaries and score to sales sheet.",
        },
      },
      {
        templateId: "skill",
        position: { x: 690, y: 250 },
        configOverrides: {
          skill: "Calendar",
          enabled: true,
          instruction: "Suggest booking slots and confirm timezone-aware meeting options.",
        },
      },
      {
        templateId: "trigger",
        position: { x: 1020, y: 80 },
        configOverrides: { type: "webhook", webhookEvent: "lead_created" },
      },
      {
        templateId: "output",
        position: { x: 1020, y: 250 },
        configOverrides: { channel: "email", destination: "sales@company.com" },
      },
    ],
    edges: [
      [4, 1],
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 5],
      [3, 5],
    ],
  },
  {
    id: "ops-coordinator",
    name: "Ops Coordinator",
    description: "Daily operational sync with scheduled reports and team alert routing.",
    seeds: [
      {
        templateId: "identity",
        position: { x: 40, y: 160 },
        configOverrides: {
          name: "Mira Ops",
          role: "Operations Coordinator",
          formalTone: 70,
          detailLevel: 75,
        },
      },
      {
        templateId: "brain",
        position: { x: 360, y: 160 },
        configOverrides: {
          model: "gpt-4o",
          memory: "permanent",
          guardrails: "Prioritize factual updates and explicitly flag anomalies or blockers.",
        },
      },
      {
        templateId: "skill",
        position: { x: 690, y: 70 },
        configOverrides: {
          skill: "Google Sheets",
          enabled: true,
          instruction: "Pull KPI rows and summarize performance deltas day-over-day.",
        },
      },
      {
        templateId: "skill",
        position: { x: 690, y: 250 },
        configOverrides: {
          skill: "Webhook",
          enabled: true,
          instruction: "Trigger downstream automation for high-priority incidents.",
        },
      },
      {
        templateId: "trigger",
        position: { x: 1020, y: 80 },
        configOverrides: { type: "cron", cron: "0 9 * * 1-5" },
      },
      {
        templateId: "output",
        position: { x: 1020, y: 250 },
        configOverrides: { channel: "slack", destination: "#ops-daily" },
      },
    ],
    edges: [
      [4, 1],
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 5],
      [3, 5],
    ],
  },
];

export function iconForKind(kind: NodeTemplate["kind"]) {
  switch (kind) {
    case "identity":
      return "ID";
    case "brain":
      return "AI";
    case "skill":
      return "SK";
    case "trigger":
      return "TR";
    case "output":
      return "OUT";
    default:
      return "--";
  }
}
