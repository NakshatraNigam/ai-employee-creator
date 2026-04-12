"use client";

import clsx from "clsx";
import Image from "next/image";

import type { BuildReadiness, EmployeeSummary } from "@/lib/agent-builder/types";

interface EmployeeCardProps {
  summary: EmployeeSummary;
  readiness: BuildReadiness;
}

function prettyChannelName(channel: string) {
  return channel.replace("-", " ");
}

export function EmployeeCard({ summary, readiness }: EmployeeCardProps) {
  const avatarSrc = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(summary.name)}`;

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <Image
          className="h-14 w-14 rounded-2xl border border-zinc-200 bg-zinc-100"
          src={avatarSrc}
          alt={summary.name}
          width={56}
          height={56}
        />
        <div>
          <p className="font-heading text-lg font-semibold text-zinc-900">{summary.name}</p>
          <p className="text-sm text-zinc-600">{summary.role}</p>
        </div>
        <span
          className={clsx(
            "ml-auto rounded-full px-3 py-1 text-xs font-medium",
            summary.status === "Ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
          )}
        >
          {summary.status}
        </span>
      </div>

      <div className="mb-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wide text-zinc-600">Launch readiness</span>
          <span className="font-semibold text-zinc-800">{readiness.score}%</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-200">
          <div className="h-2 rounded-full bg-zinc-900 transition-all" style={{ width: `${readiness.score}%` }} />
        </div>
      </div>

      <div className="space-y-2 text-sm text-zinc-700">
        <p>
          <span className="font-semibold text-zinc-900">Brain:</span> {summary.model}
        </p>
        <p>
          <span className="font-semibold text-zinc-900">Memory:</span> {summary.memory}
        </p>
        <p>
          <span className="font-semibold text-zinc-900">Skills:</span>{" "}
          {summary.skills.length > 0 ? summary.skills.join(", ") : "No active skills yet"}
        </p>
        <p>
          <span className="font-semibold text-zinc-900">Output:</span>{" "}
          {summary.outputs.length > 0
            ? summary.outputs.map((output) => prettyChannelName(output)).join(", ")
            : "No output channel yet"}
        </p>
      </div>

      <div className="mt-3 space-y-1">
        {readiness.checks.slice(0, 3).map((check) => (
          <p key={check.key} className={`text-xs ${check.done ? "text-emerald-700" : "text-zinc-500"}`}>
            {check.done ? "Done" : "Todo"}: {check.label}
          </p>
        ))}
      </div>
    </section>
  );
}
