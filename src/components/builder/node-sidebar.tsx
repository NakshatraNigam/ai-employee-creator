"use client";

import { useMemo, useState } from "react";

import clsx from "clsx";

import { AGENT_BLUEPRINTS, NODE_TEMPLATES, iconForKind } from "@/lib/agent-builder/templates";
import { DRAG_TEMPLATE_MIME, type BuildReadiness, type LayerKind } from "@/lib/agent-builder/types";

interface NodeSidebarProps {
  onClearCanvas: () => void;
  onSave: () => void;
  onAddTemplate: (templateId: string) => void;
  onApplyBlueprint: (blueprintId: string) => void;
  canSave: boolean;
  saveLabel: string;
  readiness: BuildReadiness;
}

const kindBadgeStyles: Record<LayerKind, string> = {
  identity: "bg-orange-100 text-orange-700",
  brain: "bg-sky-100 text-sky-700",
  skill: "bg-emerald-100 text-emerald-700",
  trigger: "bg-amber-100 text-amber-700",
  output: "bg-indigo-100 text-indigo-700",
};

export function NodeSidebar({
  onClearCanvas,
  onSave,
  onAddTemplate,
  onApplyBlueprint,
  canSave,
  saveLabel,
  readiness,
}: NodeSidebarProps) {
  const [query, setQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return NODE_TEMPLATES;
    }
    return NODE_TEMPLATES.filter(
      (template) =>
        template.title.toLowerCase().includes(term) ||
        template.subtitle.toLowerCase().includes(term) ||
        template.kind.toLowerCase().includes(term),
    );
  }, [query]);

  const onDragStart = (event: React.DragEvent<HTMLButtonElement>, templateId: string) => {
    event.dataTransfer.setData(DRAG_TEMPLATE_MIME, templateId);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/90 shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-4">
        <h2 className="font-heading text-lg font-semibold text-zinc-900">Builder Layers</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Drag or click layers into canvas. Use blueprints for instant high-quality starts.
        </p>
      </div>

      <div className="space-y-4 border-b border-zinc-200 p-3">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-zinc-600">Readiness</span>
            <span className="font-semibold text-zinc-800">{readiness.score}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-200">
            <div className="h-2 rounded-full bg-zinc-900 transition-all" style={{ width: `${readiness.score}%` }} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {readiness.completed}/{readiness.total} complete
          </p>
          <p className="mt-1 text-xs text-zinc-600">{readiness.nextAction}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">Quick-start blueprints</p>
          <div className="space-y-2">
            {AGENT_BLUEPRINTS.map((blueprint) => (
              <button
                key={blueprint.id}
                type="button"
                onClick={() => onApplyBlueprint(blueprint.id)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-left transition hover:border-zinc-400 hover:shadow-sm"
              >
                <p className="text-sm font-semibold text-zinc-900">{blueprint.name}</p>
                <p className="text-xs text-zinc-500">{blueprint.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search layers..."
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
          />
        </div>

        {filteredTemplates.map((template) => (
          <div key={template.id} className="rounded-2xl border border-zinc-200 bg-white p-3 transition hover:border-zinc-400 hover:shadow-sm">
            <button
              draggable
              onDragStart={(event) => onDragStart(event, template.id)}
              onClick={() => onAddTemplate(template.id)}
              className="w-full text-left"
              type="button"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-zinc-500">{iconForKind(template.kind)}</span>
                <span className={clsx("rounded-full px-2 py-1 text-[10px] font-medium uppercase", kindBadgeStyles[template.kind])}>
                  {template.kind}
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-900">{template.title}</p>
              <p className="text-xs text-zinc-500">{template.subtitle}</p>
            </button>
            <button
              type="button"
              onClick={() => onAddTemplate(template.id)}
              className="mt-2 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500"
            >
              Add to canvas
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-zinc-200 p-3">
        <button
          type="button"
          onClick={onClearCanvas}
          className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400"
        >
          New
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {saveLabel}
        </button>
      </div>
    </aside>
  );
}
