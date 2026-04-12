"use client";

interface WorkflowRunResult {
  runId: string;
  response: string;
  modelRequested: string;
  modelUsed: string;
  knowledgeMatchesUsed: number;
  warnings: string[];
  outputsTriggered: string[];
  memorySessionId: string | null;
}

interface WorkflowRunnerPanelProps {
  selectedConfigId: string | null;
  onOpen: () => void;
  lastRun: WorkflowRunResult | null;
}

export function WorkflowRunnerPanel({ selectedConfigId, onOpen, lastRun }: WorkflowRunnerPanelProps) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-heading text-lg font-semibold text-zinc-900">Workflow Studio</h3>
      {!selectedConfigId ? (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          Save an employee config first, then open the workflow studio.
        </p>
      ) : (
        <>
          <div className="mt-2 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">
            Run prompts in a centered workspace with a dedicated output console.
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="mt-3 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Open Workflow Studio
          </button>
        </>
      )}

      {lastRun && (
        <div className="mt-4 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">
            Last run: {lastRun.runId.slice(0, 8)} | model: {lastRun.modelUsed}
          </p>
          <p className="text-sm text-zinc-700">Output available in Workflow Studio.</p>
        </div>
      )}
    </section>
  );
}

export type { WorkflowRunResult };
