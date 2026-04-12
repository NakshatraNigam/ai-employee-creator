"use client";

interface KnowledgeDocumentRecord {
  id: string;
  source_name: string;
  source_type: "file" | "url";
  chunk_count: number;
  created_at: string;
}

interface KnowledgeIngestionPanelProps {
  canIngest: boolean;
  ingesting: boolean;
  selectedConfigId: string | null;
  fileCount: number;
  urlCount: number;
  onIngest: () => Promise<void>;
  documents: KnowledgeDocumentRecord[];
}

export function KnowledgeIngestionPanel({
  canIngest,
  ingesting,
  selectedConfigId,
  fileCount,
  urlCount,
  onIngest,
  documents,
}: KnowledgeIngestionPanelProps) {
  const hasSources = fileCount > 0 || urlCount > 0;

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-heading text-lg font-semibold text-zinc-900">Knowledge Ingestion</h3>

      {!selectedConfigId && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          Save this employee config first, then ingest files and URLs into pgvector.
        </p>
      )}

      {selectedConfigId && (
        <>
          <p className="mt-2 text-sm text-zinc-600">
            Sources ready: {fileCount} file(s), {urlCount} URL(s)
          </p>
          {!hasSources && (
            <p className="mt-2 rounded-xl bg-zinc-100 p-3 text-xs text-zinc-600">
              Add knowledge files or URLs in the Brain node config panel.
            </p>
          )}
          <button
            type="button"
            onClick={() => void onIngest()}
            disabled={!canIngest || !hasSources}
            className="mt-3 rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {ingesting ? "Ingesting..." : "Chunk + Embed + Store"}
          </button>
        </>
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Indexed documents</p>
        {documents.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No knowledge docs indexed yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {documents.map((document) => (
              <div key={document.id} className="rounded-xl border border-zinc-200 p-2">
                <p className="text-sm font-medium text-zinc-900">{document.source_name}</p>
                <p className="text-xs text-zinc-500">
                  {document.source_type} | {document.chunk_count} chunks |{" "}
                  {new Date(document.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export type { KnowledgeDocumentRecord };
