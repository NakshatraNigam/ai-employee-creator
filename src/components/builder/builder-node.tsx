"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";

import type { BuilderNodeData } from "@/lib/agent-builder/types";
import { iconForKind } from "@/lib/agent-builder/templates";

export function BuilderNode({ data, selected }: NodeProps) {
  const typedData = data as BuilderNodeData;

  return (
    <div
      className={clsx(
        "relative min-w-56 rounded-2xl border bg-white p-3 shadow-sm transition",
        selected ? "scale-[1.01] shadow-lg" : "hover:shadow-md",
      )}
      style={{ borderColor: typedData.color }}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-zinc-400" />

      <div className="mb-2 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-semibold tracking-wide text-white"
          style={{ backgroundColor: typedData.color }}
        >
          {iconForKind(typedData.kind)}
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">{typedData.title}</p>
          <p className="text-xs text-zinc-500">{typedData.kind}</p>
        </div>
      </div>

      <p className="line-clamp-2 text-xs text-zinc-600">{typedData.subtitle}</p>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-zinc-500" />
    </div>
  );
}
