"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react";
import type { User } from "@supabase/supabase-js";

import { AuthPanel } from "@/components/builder/auth-panel";
import { BuilderNode as BuilderNodeCard } from "@/components/builder/builder-node";
import { EmployeeCard } from "@/components/builder/employee-card";
import {
  KnowledgeIngestionPanel,
  type KnowledgeDocumentRecord,
} from "@/components/builder/knowledge-ingestion-panel";
import { NodeConfigPanel } from "@/components/builder/node-config-panel";
import { NodeSidebar } from "@/components/builder/node-sidebar";
import { SavedAgentList, type SavedAgentRecord } from "@/components/builder/saved-agent-list";
import {
  WorkflowRunnerPanel,
  type WorkflowRunResult,
} from "@/components/builder/workflow-runner-panel";
import { WorkflowStudioModal } from "@/components/builder/workflow-studio-modal";
import { TeamStudioModal, type TeamPipelineRunResult } from "@/components/builder/team-studio-modal";
import { AGENT_BLUEPRINTS, NODE_TEMPLATES } from "@/lib/agent-builder/templates";
import {
  DRAG_TEMPLATE_MIME,
  buildConfigDocument,
  createBuilderNode,
  summarizeReadiness,
  summarizeEmployee,
  toNodeSubtitle,
  type AgentConfigDocument,
  type AnyNodeConfig,
  type BrainConfig,
  type BuilderNode,
} from "@/lib/agent-builder/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const nodeTypes = {
  builderNode: BuilderNodeCard,
};

function templateById(templateId: string) {
  return NODE_TEMPLATES.find((template) => template.id === templateId);
}

function createStarterGraph() {
  const identityTemplate = templateById("identity");
  const brainTemplate = templateById("brain");
  const outputTemplate = templateById("output");

  if (!identityTemplate || !brainTemplate || !outputTemplate) {
    return { nodes: [] as BuilderNode[], edges: [] as Edge[] };
  }

  const identityNode = createBuilderNode(identityTemplate, { x: 60, y: 180 });
  const brainNode = createBuilderNode(brainTemplate, { x: 400, y: 180 });
  const outputNode = createBuilderNode(outputTemplate, { x: 740, y: 180 });

  return {
    nodes: [identityNode, brainNode, outputNode],
    edges: [
      {
        id: `edge-${identityNode.id}-${brainNode.id}`,
        source: identityNode.id,
        target: brainNode.id,
        animated: true,
      },
      {
        id: `edge-${brainNode.id}-${outputNode.id}`,
        source: brainNode.id,
        target: outputNode.id,
        animated: true,
      },
    ] as Edge[],
  };
}

function isValidConfigDocument(value: unknown): value is AgentConfigDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const parsed = value as Partial<AgentConfigDocument>;
  return Array.isArray(parsed.nodes) && Array.isArray(parsed.edges);
}

function BuilderCanvasInner() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>([]);

  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const starter = createStarterGraph();
    setNodes(starter.nodes);
    setEdges(starter.edges);
    setSelectedNodeId(starter.nodes[0]?.id ?? null);
  }, [setEdges, setNodes]);

  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [savedAgents, setSavedAgents] = useState<SavedAgentRecord[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [runningWorkflow, setRunningWorkflow] = useState(false);
  const [runningTeamWorkflow, setRunningTeamWorkflow] = useState(false);
  const [workflowStudioOpen, setWorkflowStudioOpen] = useState(false);
  const [teamStudioOpen, setTeamStudioOpen] = useState(false);
  const [brainUploads, setBrainUploads] = useState<Record<string, File[]>>({});
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocumentRecord[]>([]);
  const [lastRun, setLastRun] = useState<WorkflowRunResult | null>(null);
  const [lastTeamRun, setLastTeamRun] = useState<TeamPipelineRunResult | null>(null);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedBrainConfig =
    selectedNode?.data.kind === "brain" ? (selectedNode.data.config as BrainConfig) : null;
  const selectedBrainFiles = selectedNode ? (brainUploads[selectedNode.id] ?? []) : [];
  const summary = useMemo(() => summarizeEmployee(nodes), [nodes]);
  const readiness = useMemo(() => summarizeReadiness(nodes, edges), [edges, nodes]);

  const refreshSavedAgents = useCallback(async () => {
    if (!supabase || !user) {
      setSavedAgents([]);
      return;
    }

    const { data, error } = await supabase
      .from("employee_configs")
      .select("id,name,status,updated_at,config")
      .order("updated_at", { ascending: false });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setSavedAgents((data ?? []) as SavedAgentRecord[]);
  }, [supabase, user]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      setUser(data.user ?? null);
      setAuthLoading(false);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    void refreshSavedAgents();
  }, [refreshSavedAgents]);

  const refreshKnowledgeDocs = useCallback(async () => {
    if (!supabase || !user || !selectedConfigId) {
      setKnowledgeDocs([]);
      return;
    }

    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id,source_name,source_type,chunk_count,created_at")
      .eq("agent_config_id", selectedConfigId)
      .order("created_at", { ascending: false });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setKnowledgeDocs((data ?? []) as KnowledgeDocumentRecord[]);
  }, [selectedConfigId, supabase, user]);

  useEffect(() => {
    void refreshKnowledgeDocs();
  }, [refreshKnowledgeDocs]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            id: `edge-${crypto.randomUUID()}`,
            animated: true,
            style: { stroke: "#334155", strokeWidth: 2 },
          },
          currentEdges,
        ),
      );
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const templateId = event.dataTransfer.getData(DRAG_TEMPLATE_MIME);
      const template = templateById(templateId);

      if (!template) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nextNode = createBuilderNode(template, position);
      setNodes((currentNodes) => currentNodes.concat(nextNode));
      setSelectedNodeId(nextNode.id);
    },
    [screenToFlowPosition, setNodes],
  );

  const createNodeFromTemplate = useCallback(
    (
      templateId: string,
      position: { x: number; y: number },
      configOverrides?: Record<string, unknown>,
    ) => {
      const template = templateById(templateId);
      if (!template) {
        return null;
      }

      const nextNode = createBuilderNode(template, position);
      if (configOverrides) {
        const nextConfig = {
          ...(nextNode.data.config as unknown as Record<string, unknown>),
          ...configOverrides,
        } as unknown as AnyNodeConfig;

        nextNode.data.config = nextConfig;
        nextNode.data.subtitle = toNodeSubtitle(nextNode.data.kind, nextConfig);
      }

      return nextNode;
    },
    [],
  );

  const onAddTemplate = useCallback(
    (templateId: string) => {
      setNodes((currentNodes) => {
        const nextNode = createNodeFromTemplate(templateId, {
          x: 90 + (currentNodes.length % 3) * 320,
          y: 90 + Math.floor(currentNodes.length / 3) * 180,
        });

        if (!nextNode) {
          return currentNodes;
        }

        setSelectedNodeId(nextNode.id);
        return currentNodes.concat(nextNode);
      });
    },
    [createNodeFromTemplate, setNodes],
  );

  const onApplyBlueprint = useCallback(
    (blueprintId: string) => {
      const blueprint = AGENT_BLUEPRINTS.find((item) => item.id === blueprintId);
      if (!blueprint) {
        setStatusMessage("Blueprint not found.");
        return;
      }

      const blueprintNodes = blueprint.seeds
        .map((seed) =>
          createNodeFromTemplate(
            seed.templateId,
            seed.position,
            seed.configOverrides as Record<string, unknown> | undefined,
          ),
        )
        .filter((node): node is BuilderNode => Boolean(node));

      if (blueprintNodes.length === 0) {
        setStatusMessage("Blueprint failed to load.");
        return;
      }

      const blueprintEdges = blueprint.edges
        .map(([sourceIndex, targetIndex]) => {
          const source = blueprintNodes[sourceIndex];
          const target = blueprintNodes[targetIndex];
          if (!source || !target) {
            return null;
          }

          return {
            id: `edge-${source.id}-${target.id}`,
            source: source.id,
            target: target.id,
            animated: true,
            style: { stroke: "#334155", strokeWidth: 2 },
          } as Edge;
        })
        .filter((edge): edge is Edge => Boolean(edge));

      setNodes(blueprintNodes);
      setEdges(blueprintEdges);
      setSelectedNodeId(blueprintNodes[0]?.id ?? null);
      setSelectedConfigId(null);
      setKnowledgeDocs([]);
      setLastRun(null);
      setWorkflowStudioOpen(false);
      setStatusMessage(`Loaded blueprint: ${blueprint.name}. Save to persist.`);
    },
    [createNodeFromTemplate, setEdges, setNodes],
  );

  const onPatchConfig = useCallback(
    (nodeId: string, nextConfig: AnyNodeConfig) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  config: nextConfig,
                  subtitle: toNodeSubtitle(node.data.kind, nextConfig),
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const onDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      );
      setBrainUploads((currentUploads) => {
        const nextUploads = { ...currentUploads };
        delete nextUploads[nodeId];
        return nextUploads;
      });
      setSelectedNodeId((current) => (current === nodeId ? null : current));
    },
    [setEdges, setNodes],
  );

  const onClearCanvas = useCallback(() => {
    const nextGraph = createStarterGraph();
    setNodes(nextGraph.nodes);
    setEdges(nextGraph.edges);
    setSelectedNodeId(nextGraph.nodes[0]?.id ?? null);
    setSelectedConfigId(null);
    setKnowledgeDocs([]);
    setBrainUploads({});
    setLastRun(null);
    setWorkflowStudioOpen(false);
    setTeamStudioOpen(false);
    setLastTeamRun(null);
    setStatusMessage("Started a fresh employee draft.");
  }, [setEdges, setNodes]);

  const onSave = useCallback(async () => {
    if (!supabase) {
      setStatusMessage("Add Supabase env vars to save agent configs.");
      return;
    }

    if (!user) {
      setStatusMessage("Sign in before saving.");
      return;
    }

    setSaving(true);
    const document = buildConfigDocument(nodes, edges);

    if (selectedConfigId) {
      const { error } = await supabase
        .from("employee_configs")
        .update({ name: document.name, status: document.status, config: document })
        .eq("id", selectedConfigId);

      if (error) {
        setStatusMessage(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("employee_configs")
        .insert({
          user_id: user.id,
          name: document.name,
          status: document.status,
          config: document,
        })
        .select("id")
        .single();

      if (error) {
        setStatusMessage(error.message);
        setSaving(false);
        return;
      }

      setSelectedConfigId(data.id as string);
    }

    setStatusMessage("Saved agent config.");
    setSaving(false);
    await refreshSavedAgents();
  }, [edges, nodes, refreshSavedAgents, selectedConfigId, supabase, user]);

  const onSendMagicLink = useCallback(
    async (email: string) => {
      if (!supabase) {
        return "Supabase env vars are missing.";
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });

      if (error) {
        return error.message;
      }

      return "Magic link sent. Check your inbox.";
    },
    [supabase],
  );

  const onSignOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSavedAgents([]);
    setSelectedConfigId(null);
    setKnowledgeDocs([]);
    setBrainUploads({});
    setLastRun(null);
    setWorkflowStudioOpen(false);
    setStatusMessage("Signed out.");
  }, [supabase]);

  const onSelectSavedAgent = useCallback(
    (item: SavedAgentRecord) => {
      if (!isValidConfigDocument(item.config)) {
        setStatusMessage("Saved config format is invalid.");
        return;
      }

      const document = item.config;
      const loadedNodes = document.nodes.map((node) => ({ ...node, type: "builderNode" })) as BuilderNode[];
      const loadedEdges = document.edges as Edge[];

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setBrainUploads({});
      setSelectedNodeId(loadedNodes[0]?.id ?? null);
      setSelectedConfigId(item.id);
    setLastRun(null);
    setWorkflowStudioOpen(false);
    setTeamStudioOpen(false);
    setLastTeamRun(null);
    setStatusMessage(`Loaded ${item.name || "employee"}.`);
    },
    [setEdges, setNodes],
  );

  const onDeleteSavedAgent = useCallback(
    async (item: SavedAgentRecord) => {
      if (!supabase) {
        setStatusMessage("Supabase is not configured.");
        return;
      }

      if (!user) {
        setStatusMessage("Sign in before deleting saved employees.");
        return;
      }

      const confirmed = window.confirm(
        `Delete '${item.name || "Untitled Employee"}'? This cannot be undone.`,
      );
      if (!confirmed) {
        return;
      }

      setDeletingConfigId(item.id);

      const markDeletedInUi = () => {
        setSavedAgents((current) => current.filter((row) => row.id !== item.id));

        if (selectedConfigId === item.id) {
          setSelectedConfigId(null);
          setKnowledgeDocs([]);
          setLastRun(null);
          setWorkflowStudioOpen(false);
          setTeamStudioOpen(false);
          setLastTeamRun(null);
          setStatusMessage("Deleted selected employee. Current canvas is now unsaved.");
        } else {
          setStatusMessage("Deleted saved employee.");
        }
      };

      const deleteDirectlyFromClient = async () => {
        const { data, error } = await supabase
          .from("employee_configs")
          .delete()
          .eq("id", item.id)
          .eq("user_id", user.id)
          .select("id");

        if (error) {
          return { ok: false as const, error: error.message };
        }

        if (!data || data.length === 0) {
          return { ok: false as const, error: "Employee not found or no permission." };
        }

        return { ok: true as const };
      };

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        let deleteErrorMessage: string | null = null;

        if (accessToken) {
          const response = await fetch("/api/agent/delete", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              configId: item.id,
            }),
          });

          let payload: { error?: string } | null = null;
          try {
            payload = (await response.json()) as { error?: string };
          } catch {
            payload = null;
          }

          if (response.ok) {
            markDeletedInUi();
            await refreshSavedAgents();
            return;
          }

          deleteErrorMessage =
            payload?.error ?? `Delete API failed with status ${response.status}. Trying fallback...`;
        }

        const fallbackResult = await deleteDirectlyFromClient();
        if (!fallbackResult.ok) {
          const message = fallbackResult.error || deleteErrorMessage || "Delete failed.";
          setStatusMessage(message);
          window.alert(`Delete failed: ${message}`);
          return;
        }

        markDeletedInUi();
        await refreshSavedAgents();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Delete failed.";
        setStatusMessage(message);
        window.alert(`Delete failed: ${message}`);
      } finally {
        setDeletingConfigId(null);
      }
    },
    [refreshSavedAgents, selectedConfigId, supabase, user],
  );

  const onKnowledgeFilesSelected = useCallback((nodeId: string, files: File[]) => {
    setBrainUploads((currentUploads) => ({
      ...currentUploads,
      [nodeId]: files,
    }));
  }, []);

  const onIngestKnowledge = useCallback(async () => {
    if (!supabase) {
      setStatusMessage("Supabase is not configured.");
      return;
    }

    if (!user) {
      setStatusMessage("Sign in before ingesting knowledge.");
      return;
    }

    if (!selectedConfigId) {
      setStatusMessage("Save this employee config before ingestion.");
      return;
    }

    if (!selectedNode || selectedNode.data.kind !== "brain") {
      setStatusMessage("Select a Brain node to ingest knowledge.");
      return;
    }

    const currentBrainConfig = selectedNode.data.config as BrainConfig;
    const fileBatch = brainUploads[selectedNode.id] ?? [];
    const urlBatch = currentBrainConfig.knowledgeUrls ?? [];

    if (fileBatch.length === 0 && urlBatch.length === 0) {
      setStatusMessage("Add files or URLs in the Brain config first.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token;
    if (!accessToken) {
      setStatusMessage("Session token missing. Please sign in again.");
      return;
    }

    setIngesting(true);

    const formData = new FormData();
    formData.append("agentConfigId", selectedConfigId);
    formData.append("urls", JSON.stringify(urlBatch));
    for (const file of fileBatch) {
      formData.append("files", file);
    }

    try {
      const response = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const payload = (await response.json()) as {
        error?: string;
        processedCount?: number;
        totalChunks?: number;
        failedSources?: Array<{ source: string; error: string }>;
      };

      if (!response.ok) {
        setStatusMessage(payload.error ?? "Knowledge ingestion failed.");
        setIngesting(false);
        return;
      }

      const failedCount = payload.failedSources?.length ?? 0;
      const baseMessage = `Indexed ${payload.processedCount ?? 0} source(s) and ${
        payload.totalChunks ?? 0
      } chunks.`;
      setStatusMessage(failedCount > 0 ? `${baseMessage} ${failedCount} source(s) failed.` : baseMessage);
      await refreshKnowledgeDocs();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Knowledge ingestion failed.");
    } finally {
      setIngesting(false);
    }
  }, [brainUploads, refreshKnowledgeDocs, selectedConfigId, selectedNode, supabase, user]);

  const onRunWorkflow = useCallback(
    async (payload: { input: string; triggerType: "chat" | "webhook" | "cron" | "chain"; sessionId: string }) => {
      if (!supabase) {
        setStatusMessage("Supabase is not configured.");
        return;
      }

      if (!user) {
        setStatusMessage("Sign in before running workflows.");
        return;
      }

      if (!selectedConfigId) {
        setStatusMessage("Save this employee config before running.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setStatusMessage("Session token missing. Please sign in again.");
        return;
      }

      setRunningWorkflow(true);

      try {
        const response = await fetch("/api/agent/run", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            configId: selectedConfigId,
            input: payload.input,
            triggerType: payload.triggerType,
            sessionId: payload.sessionId,
          }),
        });

        const data = (await response.json()) as {
          error?: string;
          runId?: string;
          response?: string;
          modelRequested?: string;
          modelUsed?: string;
          knowledgeMatchesUsed?: number;
          warnings?: string[];
          outputsTriggered?: string[];
          memorySessionId?: string | null;
        };

        if (!response.ok || !data.response || !data.runId || !data.modelRequested || !data.modelUsed) {
          setStatusMessage(data.error ?? "Workflow execution failed.");
          setRunningWorkflow(false);
          return;
        }

        const result: WorkflowRunResult = {
          runId: data.runId,
          response: data.response,
          modelRequested: data.modelRequested,
          modelUsed: data.modelUsed,
          knowledgeMatchesUsed: data.knowledgeMatchesUsed ?? 0,
          warnings: data.warnings ?? [],
          outputsTriggered: data.outputsTriggered ?? [],
          memorySessionId: data.memorySessionId ?? null,
        };

        setLastRun(result);
        setStatusMessage("Workflow completed.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Workflow execution failed.");
      } finally {
        setRunningWorkflow(false);
      }
    },
    [selectedConfigId, supabase, user],
  );

  const handoffConditionMatches = (condition: string, text: string) => {
    const raw = condition.trim();
    if (!raw || raw.toLowerCase() === "always" || raw.toLowerCase() === "entry") {
      return true;
    }

    const lowerText = text.toLowerCase();
    const lowerCondition = raw.toLowerCase();

    if (lowerCondition.startsWith("contains:")) {
      const needle = lowerCondition.replace("contains:", "").trim();
      return needle.length > 0 ? lowerText.includes(needle) : true;
    }

    if (lowerCondition.startsWith("not contains:")) {
      const needle = lowerCondition.replace("not contains:", "").trim();
      return needle.length > 0 ? !lowerText.includes(needle) : true;
    }

    return true;
  };

  const onRunTeamPipeline = useCallback(
    async (payload: {
      input: string;
      sessionId: string;
      steps: Array<{ configId: string; name: string; handoffCondition: string }>;
    }) => {
      if (!supabase) {
        setStatusMessage("Supabase is not configured.");
        return;
      }

      if (!user) {
        setStatusMessage("Sign in before running team workflows.");
        return;
      }

      if (payload.steps.length === 0) {
        setStatusMessage("Team pipeline has no steps.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setStatusMessage("Session token missing. Please sign in again.");
        return;
      }

      setRunningTeamWorkflow(true);

      let currentOutput = payload.input;
      const stepResults: TeamPipelineRunResult["steps"] = [];
      let hardFailure = false;

      for (let index = 0; index < payload.steps.length; index += 1) {
        const step = payload.steps[index];
        const shouldRun = index === 0 || handoffConditionMatches(step.handoffCondition, currentOutput);

        if (!shouldRun) {
          stepResults.push({
            name: step.name,
            handoffCondition: step.handoffCondition,
            skipped: true,
            reason: "handoff condition not met",
          });
          continue;
        }

        const runInput =
          index === 0
            ? currentOutput
            : `Upstream output:\n${currentOutput}\n\nHandoff condition: ${step.handoffCondition}\n\nContinue the workflow and return your output.`;

        let stepPayload:
          | {
              response: string;
              modelUsed: string;
            }
          | null = null;
        let stepError = "Unknown workflow error.";

        for (const triggerType of index === 0 ? ["chat"] : (["chain", "chat"] as const)) {
          const response = await fetch("/api/agent/run", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              configId: step.configId,
              input: runInput,
              triggerType,
              sessionId: payload.sessionId,
            }),
          });

          const data = (await response.json()) as {
            error?: string;
            response?: string;
            modelUsed?: string;
          };

          if (response.ok && data.response && data.modelUsed) {
            stepPayload = {
              response: data.response,
              modelUsed: data.modelUsed,
            };
            break;
          }

          stepError = data.error ?? "Workflow execution failed.";
        }

        if (!stepPayload) {
          stepResults.push({
            name: step.name,
            handoffCondition: step.handoffCondition,
            skipped: false,
            reason: stepError,
          });
          hardFailure = true;
          break;
        }

        currentOutput = stepPayload.response;
        stepResults.push({
          name: step.name,
          handoffCondition: step.handoffCondition,
          skipped: false,
          outputSnippet:
            stepPayload.response.length > 160
              ? `${stepPayload.response.slice(0, 160)}...`
              : stepPayload.response,
          modelUsed: stepPayload.modelUsed,
        });
      }

      setLastTeamRun({
        finalOutput: currentOutput,
        steps: stepResults,
      });

      setStatusMessage(hardFailure ? "Team pipeline ended with errors." : "Team pipeline completed.");
      setRunningTeamWorkflow(false);
    },
    [supabase, user],
  );

  return (
    <main className="min-h-screen bg-canvas p-4 lg:p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-4 rounded-3xl border border-zinc-200 bg-white/90 px-6 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold text-zinc-900">AI Employee Creator</h1>
              <p className="text-sm text-zinc-600">
                Drag layers into the canvas to design an autonomous employee. Configure behavior, then save JSON
                configs to Supabase.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                  Nodes {nodes.length}
                </span>
                <span className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                  Connections {edges.length}
                </span>
                <span className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                  Readiness {readiness.score}%
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTeamStudioOpen(true)}
                disabled={savedAgents.length === 0}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Open Org Team Studio
              </button>
              <button
                type="button"
                onClick={() => setWorkflowStudioOpen(true)}
                disabled={!selectedConfigId}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Open Workflow Studio
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
          <div className="h-[calc(100vh-10rem)] min-h-[640px]">
            <NodeSidebar
              onClearCanvas={onClearCanvas}
              onSave={onSave}
              onAddTemplate={onAddTemplate}
              onApplyBlueprint={onApplyBlueprint}
              canSave={!saving}
              saveLabel={saving ? "Saving..." : "Save"}
              readiness={readiness}
            />
          </div>

          <div
            className="relative h-[calc(100vh-10rem)] min-h-[640px] overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 shadow-sm"
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              nodeTypes={nodeTypes}
              fitView
              className="bg-transparent"
            >
              <MiniMap pannable zoomable />
              <Controls />
              <Background gap={24} color="#d4d4d8" />
            </ReactFlow>

            <div className="pointer-events-none absolute left-4 top-4 rounded-xl bg-white/90 px-3 py-2 text-xs text-zinc-600 shadow-sm">
              Drag from left sidebar to drop here
            </div>
          </div>

          <div className="flex h-[calc(100vh-10rem)] min-h-[640px] flex-col gap-4 overflow-y-auto pr-1">
            <EmployeeCard summary={summary} readiness={readiness} />
            <AuthPanel
              isConfigured={isSupabaseConfigured}
              isLoading={authLoading}
              userEmail={user?.email ?? null}
              onSendMagicLink={onSendMagicLink}
              onSignOut={onSignOut}
            />
            <SavedAgentList
              items={savedAgents}
              selectedId={selectedConfigId}
              onSelect={onSelectSavedAgent}
              onDelete={onDeleteSavedAgent}
              deletingId={deletingConfigId}
            />
            <NodeConfigPanel
              node={selectedNode}
              onPatchConfig={onPatchConfig}
              onDeleteNode={onDeleteNode}
              onKnowledgeFilesSelected={onKnowledgeFilesSelected}
            />
            {selectedBrainConfig && (
              <KnowledgeIngestionPanel
                canIngest={Boolean(user) && !ingesting}
                ingesting={ingesting}
                selectedConfigId={selectedConfigId}
                fileCount={selectedBrainFiles.length}
                urlCount={selectedBrainConfig.knowledgeUrls.length}
                onIngest={onIngestKnowledge}
                documents={knowledgeDocs}
              />
            )}
            <WorkflowRunnerPanel
              selectedConfigId={selectedConfigId}
              onOpen={() => setWorkflowStudioOpen(true)}
              lastRun={lastRun}
            />
            {statusMessage && <p className="rounded-xl bg-zinc-900 px-3 py-2 text-xs text-white">{statusMessage}</p>}
          </div>
        </section>
      </div>

      <WorkflowStudioModal
        open={workflowStudioOpen}
        canRun={Boolean(user) && !runningWorkflow}
        running={runningWorkflow}
        selectedConfigId={selectedConfigId}
        lastRun={lastRun}
        onClose={() => setWorkflowStudioOpen(false)}
        onRun={onRunWorkflow}
      />

      <TeamStudioModal
        open={teamStudioOpen}
        savedAgents={savedAgents}
        running={runningTeamWorkflow}
        canRun={Boolean(user) && !runningTeamWorkflow}
        onClose={() => setTeamStudioOpen(false)}
        onRun={onRunTeamPipeline}
        lastRun={lastTeamRun}
      />
    </main>
  );
}

export function BuilderCanvas() {
  return (
    <ReactFlowProvider>
      <BuilderCanvasInner />
    </ReactFlowProvider>
  );
}
