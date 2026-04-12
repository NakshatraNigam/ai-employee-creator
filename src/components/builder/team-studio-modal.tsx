"use client";

import { useMemo, useState } from "react";

import clsx from "clsx";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import type { SavedAgentRecord } from "@/components/builder/saved-agent-list";

interface TeamNodeData extends Record<string, unknown> {
  name: string;
  role: string;
  isCoordinator: boolean;
}

type TeamNode = Node<TeamNodeData>;
type TeamEdge = Edge<{ condition?: string }>;

interface TeamPipelineStep {
  nodeId: string;
  configId: string;
  name: string;
  handoffCondition: string;
}

export interface TeamPipelineRunResult {
  finalOutput: string;
  steps: Array<{
    name: string;
    handoffCondition: string;
    skipped: boolean;
    reason?: string;
    outputSnippet?: string;
    modelUsed?: string;
  }>;
}

interface TeamStudioModalProps {
  open: boolean;
  savedAgents: SavedAgentRecord[];
  running: boolean;
  canRun: boolean;
  onClose: () => void;
  onRun: (payload: {
    input: string;
    sessionId: string;
    steps: TeamPipelineStep[];
  }) => Promise<void>;
  lastRun: TeamPipelineRunResult | null;
}

function TeamAgentNode({ data, selected }: NodeProps) {
  const typedData = data as TeamNodeData;

  return (
    <div
      className={clsx(
        "w-56 rounded-2xl border bg-white px-3 py-2 shadow-sm",
        selected ? "border-zinc-900 shadow-md" : "border-zinc-200",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-zinc-900">{typedData.name}</p>
        <span
          className={clsx(
            "rounded-full px-2 py-1 text-[10px] font-semibold uppercase",
            typedData.isCoordinator ? "bg-indigo-100 text-indigo-700" : "bg-zinc-100 text-zinc-500",
          )}
        >
          {typedData.isCoordinator ? "Coordinator" : "Agent"}
        </span>
      </div>
      <p className="truncate text-xs text-zinc-500">{typedData.role || "No role set"}</p>
    </div>
  );
}

const teamNodeTypes = {
  teamAgent: TeamAgentNode,
};

function buildRunPlan(nodes: TeamNode[], edges: TeamEdge[], coordinatorId: string | null) {
  if (!coordinatorId) {
    return { steps: [] as TeamPipelineStep[], warnings: ["Set a coordinator to execute team pipeline."] };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, TeamEdge[]>();

  for (const edge of edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge);
    adjacency.set(edge.source, list);
  }

  const steps: TeamPipelineStep[] = [];
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; handoffCondition: string }> = [
    { nodeId: coordinatorId, handoffCondition: "entry" },
  ];

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || visited.has(next.nodeId)) {
      continue;
    }

    visited.add(next.nodeId);
    const node = nodeById.get(next.nodeId);
    if (!node) {
      continue;
    }

    const configId = String(node.data.configId ?? "");
    if (!configId) {
      continue;
    }

    steps.push({
      nodeId: node.id,
      configId,
      name: String(node.data.name ?? "Team Agent"),
      handoffCondition: next.handoffCondition,
    });

    const outgoing = adjacency.get(node.id) ?? [];
    for (const edge of outgoing) {
      const condition = edge.data?.condition?.trim() || "always";
      queue.push({ nodeId: edge.target, handoffCondition: condition });
    }
  }

  const warnings: string[] = [];
  if (steps.length !== nodes.length) {
    warnings.push("Some agents are disconnected from the coordinator and will not run.");
  }

  return { steps, warnings };
}

export function TeamStudioModal({
  open,
  savedAgents,
  running,
  canRun,
  onClose,
  onRun,
  lastRun,
}: TeamStudioModalProps) {
  const [teamNodes, setTeamNodes, onTeamNodesChange] = useNodesState<TeamNode>([]);
  const [teamEdges, setTeamEdges, onTeamEdgesChange] = useEdgesState<TeamEdge>([]);
  const [selectedSavedAgentId, setSelectedSavedAgentId] = useState<string>("");
  const [coordinatorId, setCoordinatorId] = useState<string | null>(null);
  const [input, setInput] = useState("Coordinate the team and deliver a concise execution summary.");
  const [sessionId, setSessionId] = useState("team-default");
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);

  const runPlan = useMemo(
    () => buildRunPlan(teamNodes, teamEdges, coordinatorId),
    [coordinatorId, teamEdges, teamNodes],
  );

  if (!open) {
    return null;
  }

  const addSavedAgent = () => {
    const selected = savedAgents.find((item) => item.id === selectedSavedAgentId);
    if (!selected) {
      return;
    }

    const nodeId = `team-${crypto.randomUUID()}`;
    const offset = teamNodes.length;
    const nextNode: TeamNode = {
      id: nodeId,
      type: "teamAgent",
      position: {
        x: 80 + (offset % 3) * 260,
        y: 80 + Math.floor(offset / 3) * 160,
      },
      data: {
        configId: selected.id,
        name: selected.name || "Untitled Employee",
        role: "Saved employee config",
        isCoordinator: false,
      },
    };

    setTeamNodes((current) => current.concat(nextNode));
    setSelectedGraphNodeId(nodeId);
    if (!coordinatorId) {
      setCoordinatorId(nodeId);
    }
  };

  const onConnect = (connection: Connection) => {
    setTeamEdges((current) =>
      addEdge(
        {
          ...connection,
          id: `team-edge-${crypto.randomUUID()}`,
          type: "smoothstep",
          animated: true,
          data: { condition: "always" },
          label: "always",
          style: { strokeWidth: 2, stroke: "#334155" },
          labelStyle: { fontSize: 11, fill: "#475569" },
        },
        current,
      ),
    );
  };

  const editEdgeCondition = (edgeId: string) => {
    const edge = teamEdges.find((item) => item.id === edgeId);
    if (!edge) {
      return;
    }
    const current = edge.data?.condition || "always";
    const next = window.prompt(
      "Set handoff condition (examples: always, contains:urgent, not contains:blocked)",
      current,
    );
    if (next === null) {
      return;
    }

    const trimmed = next.trim() || "always";
    setTeamEdges((currentEdges) =>
      currentEdges.map((item) =>
        item.id === edgeId
          ? {
              ...item,
              data: { ...(item.data ?? {}), condition: trimmed },
              label: trimmed,
            }
          : item,
      ),
    );
  };

  const removeSelectedNode = () => {
    if (!selectedGraphNodeId) {
      return;
    }

    setTeamNodes((current) => current.filter((node) => node.id !== selectedGraphNodeId));
    setTeamEdges((current) =>
      current.filter((edge) => edge.source !== selectedGraphNodeId && edge.target !== selectedGraphNodeId),
    );
    if (coordinatorId === selectedGraphNodeId) {
      setCoordinatorId(null);
    }
    setSelectedGraphNodeId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex h-[90vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h3 className="font-heading text-xl font-semibold text-zinc-900">Org Team Studio</h3>
            <p className="text-xs text-zinc-500">
              Connect saved employees into a coordinator pipeline with handoff conditions and execution order.
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

        <div className="grid flex-1 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
          <div className="border-r border-zinc-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Add team members</p>
            <select
              value={selectedSavedAgentId}
              onChange={(event) => setSelectedSavedAgentId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
            >
              <option value="">Select saved employee...</option>
              {savedAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || "Untitled Employee"}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addSavedAgent}
              disabled={!selectedSavedAgentId}
              className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add to team map
            </button>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Selected node</p>
              <p className="mt-1 text-sm text-zinc-700">
                {selectedGraphNodeId
                  ? teamNodes.find((node) => node.id === selectedGraphNodeId)?.data.name || "Unknown"
                  : "None"}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!selectedGraphNodeId}
                  onClick={() => selectedGraphNodeId && setCoordinatorId(selectedGraphNodeId)}
                  className="rounded-lg border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Set coordinator
                </button>
                <button
                  type="button"
                  disabled={!selectedGraphNodeId}
                  onClick={removeSelectedNode}
                  className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pipeline input</p>
              <textarea
                rows={5}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
              />
              <input
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                placeholder="session id"
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
              />
              <button
                type="button"
                disabled={!canRun || running || runPlan.steps.length === 0}
                onClick={() =>
                  void onRun({
                    input,
                    sessionId,
                    steps: runPlan.steps,
                  })
                }
                className="mt-2 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {running ? "Running team..." : "Run Team Pipeline"}
              </button>
            </div>
          </div>

          <div className="relative">
            <ReactFlow
              nodes={teamNodes.map((node) => ({
                ...node,
                data: {
                  ...node.data,
                  isCoordinator: node.id === coordinatorId,
                },
              }))}
              edges={teamEdges}
              onNodesChange={onTeamNodesChange}
              onEdgesChange={onTeamEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedGraphNodeId(node.id)}
              onNodeDoubleClick={(_, node) => setCoordinatorId(node.id)}
              onEdgeDoubleClick={(_, edge) => editEdgeCondition(edge.id)}
              onPaneClick={() => setSelectedGraphNodeId(null)}
              nodeTypes={teamNodeTypes}
              fitView
            >
              <MiniMap pannable zoomable />
              <Controls />
              <Background gap={20} color="#d4d4d8" />
            </ReactFlow>

            <div className="pointer-events-none absolute left-4 top-4 rounded-xl bg-white/90 px-3 py-2 text-xs text-zinc-600 shadow-sm">
              Double-click node to set coordinator | Double-click edge to edit handoff condition
            </div>
          </div>

          <div className="border-l border-zinc-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Execution order</p>
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
              {runPlan.steps.length === 0 ? (
                <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-500">
                  Add agents and set a coordinator to generate pipeline order.
                </p>
              ) : (
                runPlan.steps.map((step, index) => (
                  <div key={step.nodeId} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-sm font-semibold text-zinc-900">
                      {index + 1}. {step.name}
                    </p>
                    <p className="text-xs text-zinc-600">handoff: {step.handoffCondition}</p>
                  </div>
                ))
              )}
            </div>

            {runPlan.warnings.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                {runPlan.warnings.join(" ")}
              </div>
            )}

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Pipeline output</p>
            {!lastRun ? (
              <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
                Run the team pipeline to see aggregated output.
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="max-h-44 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="whitespace-pre-wrap text-sm text-zinc-800">{lastRun.finalOutput}</p>
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {lastRun.steps.map((step, index) => (
                    <div key={`${step.name}-${index}`} className="rounded-xl border border-zinc-200 p-2">
                      <p className="text-xs font-semibold text-zinc-700">{step.name}</p>
                      <p className="text-xs text-zinc-500">
                        {step.skipped ? `skipped: ${step.reason || "condition unmet"}` : `model: ${step.modelUsed || "-"}`}
                      </p>
                      {step.outputSnippet && <p className="mt-1 text-xs text-zinc-600">{step.outputSnippet}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
