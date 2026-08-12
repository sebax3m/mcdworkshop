/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  ChevronDown,
  Database,
  History,
  Library,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  docGenerationLabel,
  extractCandidate,
  sectionReference,
  sendAnswerFeedback,
  FEEDBACK_REASONS,
  type TechAnswer,
} from "@/lib/mcd-tech";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/garage/SpecMeta";
import { SaveExtractionDialog } from "@/components/garage/SaveExtractionDialog";

const SOURCE_META: Record<string, { label: string; icon: any; tone: string }> = {
  structured: { label: "Verified Garage Library", icon: Database, tone: "text-emerald-400 border-emerald-500/40" },
  document: { label: "Technical document", icon: BookOpen, tone: "text-sky-400 border-sky-500/40" },
  history: { label: "Workshop history", icon: History, tone: "text-amber-400 border-amber-500/40" },
  external_ai: { label: "External AI · unverified", icon: Bot, tone: "text-fuchsia-400 border-fuchsia-500/40" },
  none: { label: "No answer found", icon: AlertTriangle, tone: "text-muted-foreground border-border" },
};

export function AnswerCard({
  answer,
  modelId,
  onSaved,
}: {
  answer: TechAnswer;
  modelId?: string | null;
  onSaved?: () => void;
}) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [extract, setExtract] = useState<ReturnType<typeof extractCandidate> | null>(null);
  const meta = SOURCE_META[answer.source] ?? SOURCE_META["none"]!;
  const Icon = meta.icon;

  async function feedback(helpful: boolean, reason?: string) {
    if (!answer.queryId) return;
    try {
      await sendAnswerFeedback(answer.queryId, helpful, reason);
      setFeedbackSent(true);
      setReasonOpen(false);
      toast.success(helpful ? "Marked helpful" : "Flagged for review");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send feedback");
    }
  }

  return (
    <div className="card-surface p-4 space-y-3">
      <div className="flex items-start gap-2 flex-wrap">
        <h3 className="font-display text-sm font-semibold tracking-wide">{answer.heading}</h3>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-wider ${meta.tone}`}
        >
          <Icon className="h-3 w-3" />
          {meta.label}
        </span>
        {answer.cacheHit && (
          <span className="rounded border border-border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase text-muted-foreground">
            cached
          </span>
        )}
      </div>

      {/* CONFLICTS — never silently resolved */}
      {answer.conflicts.length > 0 && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3 space-y-2">
          <div className="flex items-center gap-1 text-[0.65rem] font-mono uppercase tracking-wider text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Specification conflict · requires review
          </div>
          {answer.conflicts.map((c, i) => (
            <div key={i} className="text-sm">
              <div className="font-semibold">{c.label}</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-0.5">
                <div>
                  <div className="text-muted-foreground">{c.left.source}</div>
                  <div>{c.left.value}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{c.right.source}</div>
                  <div>{c.right.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SPECIFICATION TABLE */}
      {answer.specs.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {answer.specs.map((s, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="py-1.5 pr-3 text-muted-foreground w-1/3">{s.label}</td>
                <td className="py-1.5 font-mono">
                  {s.value}
                  {s.note ? <span className="text-muted-foreground"> · {s.note}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {answer.source === "external_ai" && answer.aiText && (
        <pre className="whitespace-pre-wrap font-sans text-sm">{answer.aiText}</pre>
      )}

      {answer.source === "none" && (
        <p className="text-sm text-muted-foreground">
          No verified value, document section or workshop record matched this question for this exact
          model and year. It has been logged so it can be added to the Garage Library.
        </p>
      )}

      {/* DOCUMENT SOURCES */}
      {answer.sections.length > 0 && (
        <div className="space-y-2">
          <div className="text-[0.6rem] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            Source
          </div>
          {answer.sections.map((sec) => {
            const open = openSection === sec.chunk_id;
            const ref = sectionReference(sec);
            return (
              <div key={sec.chunk_id} className="rounded border border-border">
                <button
                  className="w-full flex items-center gap-2 p-2 text-left"
                  onClick={() => setOpenSection(open ? null : sec.chunk_id)}
                >
                  <Library className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm truncate">
                      {sec.manufacturer} {sec.title}
                      {sec.version ? ` · v${sec.version}` : ""}
                    </div>
                    <div className="text-[0.65rem] font-mono text-muted-foreground truncate">
                      {sec.doc_model ?? "—"} · {docGenerationLabel(sec)}
                      {ref ? ` · ${ref}` : ""}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <VerificationBadge value={sec.verification} />
                    <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {open && (
                  <div className="border-t border-border p-2 space-y-2">
                    <p className="text-sm whitespace-pre-wrap">{sec.content}</p>
                    {modelId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const cand = extractCandidate(sec, answer.question);
                          if (!cand) return toast.error("No value detected in this section");
                          setExtract(cand);
                        }}
                      >
                        Save to Garage Library
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FEEDBACK */}
      {answer.queryId && (
        <div className="flex items-center gap-2 pt-1">
          {feedbackSent ? (
            <span className="text-xs text-muted-foreground">Thanks — feedback recorded.</span>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="gap-1 h-8" onClick={() => feedback(true)}>
                <ThumbsUp className="h-3.5 w-3.5" /> Helpful
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 h-8"
                onClick={() => setReasonOpen((v) => !v)}
              >
                <ThumbsDown className="h-3.5 w-3.5" /> Incorrect
              </Button>
            </>
          )}
        </div>
      )}
      {reasonOpen && !feedbackSent && (
        <div className="flex flex-wrap gap-1">
          {FEEDBACK_REASONS.map((r) => (
            <Button key={r} size="sm" variant="outline" className="h-7 text-xs" onClick={() => feedback(false, r)}>
              {r}
            </Button>
          ))}
        </div>
      )}

      {extract && modelId && (
        <SaveExtractionDialog
          candidate={extract}
          modelId={modelId}
          onClose={() => setExtract(null)}
          onSaved={() => {
            setExtract(null);
            onSaved?.();
          }}
        />
      )}
    </div>
  );
}
