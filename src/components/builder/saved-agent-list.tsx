"use client";

export interface SavedAgentRecord {
  id: string;
  name: string;
  status: "draft" | "active";
  updated_at: string;
  config: unknown;
}

interface SavedAgentListProps {
  items: SavedAgentRecord[];
  selectedId: string | null;
  onSelect: (item: SavedAgentRecord) => void;
  onDelete: (item: SavedAgentRecord) => void;
  deletingId: string | null;
}

export function SavedAgentList({
  items,
  selectedId,
  onSelect,
  onDelete,
  deletingId,
}: SavedAgentListProps) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-heading text-lg font-semibold text-zinc-900">Saved Employees</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No saved configs yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border px-3 py-2 transition ${
                selectedId === item.id
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => onSelect(item)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold">{item.name || "Untitled Employee"}</p>
                  <p className={`text-xs ${selectedId === item.id ? "text-zinc-200" : "text-zinc-500"}`}>
                    {item.status} | {new Date(item.updated_at).toLocaleString()}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(item);
                  }}
                  disabled={deletingId === item.id}
                  className={`relative z-10 pointer-events-auto rounded-lg px-2 py-1 text-xs font-medium transition ${
                    selectedId === item.id
                      ? "border border-zinc-600 text-zinc-200 hover:bg-zinc-800"
                      : "border border-red-200 text-red-600 hover:bg-red-50"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {deletingId === item.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
