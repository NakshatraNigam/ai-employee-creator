"use client";

import { useState } from "react";

import type { WorkflowRunResult } from "@/components/builder/workflow-runner-panel";

type TriggerType = "chat" | "webhook" | "cron" | "chain";

interface WorkflowStudioModalProps {
  open: boolean;
  canRun: boolean;
  running: boolean;
  selectedConfigId: string | null;
  lastRun: WorkflowRunResult | null;
  statusMessage: string | null;
  onClose: () => void;
  onRun: (payload: { input: string; triggerType: TriggerType; sessionId: string }) => Promise<void>;
}

export function WorkflowStudioModal({
  open,
  canRun,
  running,
  selectedConfigId,
  lastRun,
  statusMessage,
  onClose,
  onRun,
}: WorkflowStudioModalProps) {
  const [input, setInput] = useState("Summarize top customer issues this week and suggest next actions.");
  const [sessionId, setSessionId] = useState("default");
  const [triggerType, setTriggerType] = useState<TriggerType>("chat");

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h3 className="font-heading text-xl font-semibold text-zinc-900">Workflow Studio</h3>
            <p className="text-xs text-zinc-500">
              Run prompts independently and inspect output in a dedicated execution console.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:border-zinc-400"
          >
            Close
          </button>
        </div>

        {!selectedConfigId ? (
          <div className="m-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
            Save an employee config first, then run workflows from this studio.
          </div>
        ) : (
          <div className="grid flex-1 gap-0 lg:grid-cols-[46%_54%]">
            <div className="border-r border-zinc-200 p-5">
              <div className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-600">Trigger</span>
                  <select
                    value={triggerType}
                    onChange={(event) => setTriggerType(event.target.value as TriggerType)}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
                  >
                    <option value="chat">chat</option>
                    <option value="webhook">webhook</option>
                    <option value="cron">cron</option>
                    <option value="chain">chain</option>
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-600">Memory session</span>
                  <input
                    value={sessionId}
                    onChange={(event) => setSessionId(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-600">Prompt input</span>
                  <textarea
                    rows={12}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
                    placeholder="Type what you want this employee to do..."
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void onRun({ input, triggerType, sessionId })}
                  disabled={!canRun || running || input.trim().length === 0}
                  className="w-full rounded-xl bg-zinc-900 px-3 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {running ? "Running workflow..." : "Execute Workflow"}
                </button>

                {statusMessage && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-600">
                    {statusMessage}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Output Console</p>

              {!lastRun ? (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
                  Run a prompt to view output here.
                </div>
              ) : (
                <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                  <div className="border-b border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500">
                    Run {lastRun.runId.slice(0, 8)} | model {lastRun.modelUsed} | context chunks{" "}
                    {lastRun.knowledgeMatchesUsed}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">{lastRun.response}</p>
                  </div>
                  {lastRun.warnings.length > 0 && (
                    <div className="border-t border-zinc-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      {lastRun.warnings.join(" ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
