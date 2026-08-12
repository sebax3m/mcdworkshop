/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { fetchChecklist } from "@/lib/garage-brief";

const storageKey = (jobId: string | null | undefined, key: string) => `mcd-checklist:${jobId ?? "generic"}:${key}`;

/** Reusable checklist a technician can work through during a job. */
export function ChecklistRunner({
  operationKey,
  modelId,
  jobId,
}: {
  operationKey: string;
  modelId?: string | null;
  jobId?: string | null;
}) {
  const { data: list } = useQuery({
    queryKey: ["checklist", operationKey, modelId ?? null],
    queryFn: () => fetchChecklist(operationKey, modelId ?? null),
  });
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(jobId, operationKey));
      setDone(raw ? JSON.parse(raw) : {});
    } catch {
      setDone({});
    }
  }, [jobId, operationKey]);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(storageKey(jobId, operationKey), JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }

  if (!list) return <div className="text-sm text-muted-foreground">No checklist for this operation yet.</div>;

  const completed = list.items.filter((i) => done[i.id]).length;

  return (
    <div className="rounded border border-border p-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{list.title}</span>
        {list.model_id ? (
          <span className="text-[0.6rem] font-mono uppercase rounded border border-sky-500/40 text-sky-400 px-1.5 py-0.5">
            model specific
          </span>
        ) : null}
        <span className="ml-auto text-xs font-mono text-muted-foreground">
          {completed}/{list.items.length}
        </span>
      </div>
      {list.items.map((i) => (
        <button
          key={i.id}
          onClick={() => toggle(i.id)}
          className="w-full flex items-start gap-2 text-left py-0.5 group"
        >
          <span
            className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
              done[i.id] ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-border"
            }`}
          >
            {done[i.id] ? <Check className="h-3 w-3" /> : null}
          </span>
          <span className={`text-sm ${done[i.id] ? "line-through text-muted-foreground" : ""}`}>
            {i.label}
            {i.torque_ref ? <span className="font-mono text-xs text-muted-foreground"> · {i.torque_ref}</span> : null}
            {i.note ? <span className="text-xs text-muted-foreground"> — {i.note}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
