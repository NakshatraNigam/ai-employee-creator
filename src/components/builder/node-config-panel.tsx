"use client";

import type { ChangeEvent } from "react";

import {
  MEMORY_OPTIONS,
  MODEL_OPTIONS,
  OUTPUT_OPTIONS,
  SKILL_OPTIONS,
  TRIGGER_OPTIONS,
} from "@/lib/agent-builder/templates";
import type {
  AnyNodeConfig,
  BrainConfig,
  BuilderNode,
  IdentityConfig,
  OutputConfig,
  SkillConfig,
  TriggerConfig,
} from "@/lib/agent-builder/types";

interface NodeConfigPanelProps {
  node: BuilderNode | null;
  onPatchConfig: (nodeId: string, nextConfig: AnyNodeConfig) => void;
  onDeleteNode: (nodeId: string) => void;
  onKnowledgeFilesSelected: (nodeId: string, files: File[]) => void;
}

function labelText(value: string) {
  return value.replace("-", " ");
}

function toneDescriptor(value: number) {
  if (value >= 70) {
    return "Formal";
  }
  if (value <= 30) {
    return "Casual";
  }
  return "Balanced";
}

function detailDescriptor(value: number) {
  if (value >= 70) {
    return "Detailed";
  }
  if (value <= 30) {
    return "Brief";
  }
  return "Moderate";
}

export function NodeConfigPanel({
  node,
  onPatchConfig,
  onDeleteNode,
  onKnowledgeFilesSelected,
}: NodeConfigPanelProps) {
  if (!node) {
    return (
      <aside className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="font-heading text-lg font-semibold text-zinc-900">Configure Node</h3>
        <p className="mt-2 text-sm text-zinc-500">Click a node in the canvas to configure its settings.</p>
      </aside>
    );
  }

  const config = node.data.config;

  const patch = (nextConfig: AnyNodeConfig) => {
    onPatchConfig(node.id, nextConfig);
  };

  const onUploadKnowledge = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    patch({ ...(config as BrainConfig), knowledgeFiles: files.map((file) => file.name) });
    onKnowledgeFilesSelected(node.id, files);
  };

  return (
    <aside className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold text-zinc-900">Configure {node.data.title}</h3>
          <p className="text-xs text-zinc-500">Node ID: {node.id.slice(0, 12)}</p>
        </div>
        <button
          type="button"
          onClick={() => onDeleteNode(node.id)}
          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Customization Coach</p>
        <p className="mt-1 text-xs text-zinc-600">
          Edit this node and instantly shape the employee behavior and execution quality.
        </p>
      </div>

      {node.data.kind === "identity" && (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Name</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
              value={(config as IdentityConfig).name}
              onChange={(event) => patch({ ...(config as IdentityConfig), name: event.target.value })}
              placeholder="Ava Ops"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Role</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
              value={(config as IdentityConfig).role}
              onChange={(event) => patch({ ...(config as IdentityConfig), role: event.target.value })}
              placeholder="Customer Support Specialist"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">
              Tone (formal to casual) - {toneDescriptor((config as IdentityConfig).formalTone)}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={(config as IdentityConfig).formalTone}
              onChange={(event) =>
                patch({ ...(config as IdentityConfig), formalTone: Number(event.target.value) })
              }
              className="w-full accent-orange-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">
              Response style (brief to detailed) - {detailDescriptor((config as IdentityConfig).detailLevel)}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={(config as IdentityConfig).detailLevel}
              onChange={(event) =>
                patch({ ...(config as IdentityConfig), detailLevel: Number(event.target.value) })
              }
              className="w-full accent-orange-500"
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                patch({
                  ...(config as IdentityConfig),
                  formalTone: 78,
                  detailLevel: 68,
                })
              }
              className="rounded-xl border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500"
            >
              Executive
            </button>
            <button
              type="button"
              onClick={() =>
                patch({
                  ...(config as IdentityConfig),
                  formalTone: 45,
                  detailLevel: 45,
                })
              }
              className="rounded-xl border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500"
            >
              Balanced
            </button>
            <button
              type="button"
              onClick={() =>
                patch({
                  ...(config as IdentityConfig),
                  formalTone: 25,
                  detailLevel: 75,
                })
              }
              className="rounded-xl border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500"
            >
              Friendly
            </button>
          </div>

          <div className="rounded-xl bg-orange-50 p-3 text-xs text-orange-900">
            Voice preview:{" "}
            <span className="font-medium">
              {toneDescriptor((config as IdentityConfig).formalTone)} and{" "}
              {detailDescriptor((config as IdentityConfig).detailLevel).toLowerCase()} communicator.
            </span>
          </div>
        </div>
      )}

      {node.data.kind === "brain" && (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Model</span>
            <select
              value={(config as BrainConfig).model}
              onChange={(event) => patch({ ...(config as BrainConfig), model: event.target.value as BrainConfig["model"] })}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Memory</span>
            <select
              value={(config as BrainConfig).memory}
              onChange={(event) =>
                patch({ ...(config as BrainConfig), memory: event.target.value as BrainConfig["memory"] })
              }
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            >
              {MEMORY_OPTIONS.map((memory) => (
                <option key={memory} value={memory}>
                  {memory}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Knowledge files (PDF/CSV)</span>
            <input
              type="file"
              accept=".pdf,.csv"
              multiple
              onChange={onUploadKnowledge}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-1 file:text-sky-700"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Knowledge URLs (comma-separated)</span>
            <textarea
              rows={3}
              value={(config as BrainConfig).knowledgeUrls.join(", ")}
              onChange={(event) =>
                patch({
                  ...(config as BrainConfig),
                  knowledgeUrls: event.target.value
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter(Boolean),
                })
              }
              placeholder="https://docs.example.com/faq, https://help.example.com"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Guardrails</span>
            <textarea
              rows={3}
              value={(config as BrainConfig).guardrails}
              onChange={(event) => patch({ ...(config as BrainConfig), guardrails: event.target.value })}
              placeholder="Never expose API keys. Escalate legal/compliance questions."
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
            />
          </label>

          <div className="rounded-xl bg-sky-50 p-3 text-xs text-sky-900">
            Knowledge assets: {(config as BrainConfig).knowledgeFiles.length} files and{" "}
            {(config as BrainConfig).knowledgeUrls.length} URLs.
          </div>
        </div>
      )}

      {node.data.kind === "skill" && (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Skill Type</span>
            <select
              value={(config as SkillConfig).skill}
              onChange={(event) => patch({ ...(config as SkillConfig), skill: event.target.value as SkillConfig["skill"] })}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            >
              {SKILL_OPTIONS.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={(config as SkillConfig).enabled}
              onChange={(event) => patch({ ...(config as SkillConfig), enabled: event.target.checked })}
              className="h-4 w-4 accent-emerald-600"
            />
            Skill enabled
          </label>

          <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
            Tip: write outcomes, not tool mechanics. Example: Return a 5-bullet summary with action owners.
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Instruction</span>
            <textarea
              rows={3}
              value={(config as SkillConfig).instruction}
              onChange={(event) => patch({ ...(config as SkillConfig), instruction: event.target.value })}
              placeholder="How this tool should be used by the employee."
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </label>
        </div>
      )}

      {node.data.kind === "trigger" && (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Trigger Type</span>
            <select
              value={(config as TriggerConfig).type}
              onChange={(event) => patch({ ...(config as TriggerConfig), type: event.target.value as TriggerConfig["type"] })}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-amber-500 focus:ring-2"
            >
              {TRIGGER_OPTIONS.map((trigger) => (
                <option key={trigger} value={trigger}>
                  {labelText(trigger)}
                </option>
              ))}
            </select>
          </label>

          {(config as TriggerConfig).type === "cron" && (
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">Cron schedule</span>
              <input
                value={(config as TriggerConfig).cron}
                onChange={(event) => patch({ ...(config as TriggerConfig), cron: event.target.value })}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-amber-500 focus:ring-2"
                placeholder="0 9 * * 1-5"
              />
            </label>
          )}

          {(config as TriggerConfig).type === "webhook" && (
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">Webhook event name</span>
              <input
                value={(config as TriggerConfig).webhookEvent}
                onChange={(event) =>
                  patch({ ...(config as TriggerConfig), webhookEvent: event.target.value })
                }
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-amber-500 focus:ring-2"
                placeholder="lead_created"
              />
            </label>
          )}

          {(config as TriggerConfig).type === "chain" && (
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">Source agent</span>
              <input
                value={(config as TriggerConfig).chainSource}
                onChange={(event) => patch({ ...(config as TriggerConfig), chainSource: event.target.value })}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-amber-500 focus:ring-2"
                placeholder="coordinator-agent"
              />
            </label>
          )}

          {(config as TriggerConfig).type === "chat" && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              This employee is triggered on demand through chat/widget interactions.
            </p>
          )}
        </div>
      )}

      {node.data.kind === "output" && (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Output Channel</span>
            <select
              value={(config as OutputConfig).channel}
              onChange={(event) =>
                patch({ ...(config as OutputConfig), channel: event.target.value as OutputConfig["channel"] })
              }
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            >
              {OUTPUT_OPTIONS.map((output) => (
                <option key={output} value={output}>
                  {labelText(output)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Destination</span>
            <input
              value={(config as OutputConfig).destination}
              onChange={(event) => patch({ ...(config as OutputConfig), destination: event.target.value })}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
              placeholder="support@company.com or #ops-alerts"
            />
          </label>

          <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900">
            Output strategy: pair one primary channel (for delivery) with one archival channel (for traceability).
          </div>
        </div>
      )}
    </aside>
  );
}
