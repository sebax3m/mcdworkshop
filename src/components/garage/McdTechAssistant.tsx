/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ClipboardList,
  History as HistoryIcon,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnswerCard } from "@/components/garage/AnswerCard";
import { askTech, type TechAnswer } from "@/lib/mcd-tech";
import {
  EMPTY_CONTEXT,
  buildJobContext,
  buildModelContext,
  buildMotorcycleContext,
  ensureConversation,
  generationCandidates,
  isSafetySensitive,
  listConversations,
  loadConversation,
  saveMessage,
  summariseJob,
  type GenerationChoice,
  type McdContext,
} from "@/lib/mcd-tech-context";
import { useMcdTechAccess } from "@/lib/mcd-tech-settings";
import { cleanTechnicianNote, explainToCustomer } from "@/lib/mcd-tech-assist.functions";

/* ------------------------------------------------------------------ *
 * GLOBAL CONTROLLER
 * ------------------------------------------------------------------ */

export type McdTechTarget =
  | { kind: "job"; jobId: string }
  | { kind: "motorcycle"; motorcycleId: string }
  | { kind: "model"; modelId: string }
  | { kind: "global" };

type Ctl = { open: (target?: McdTechTarget) => void };

const McdTechCtl = createContext<Ctl>({ open: () => {} });
export const useMcdTech = () => useContext(McdTechCtl);

type Entry =
  | { id: string; kind: "question"; text: string }
  | { id: string; kind: "answer"; answer: TechAnswer }
  | { id: string; kind: "text"; title: string; body: string };

const QUICK_ACTIONS = [
  { label: "OIL", q: "Engine oil capacity and specification" },
  { label: "TORQUES", q: "Key tightening torque specifications" },
  { label: "VALVES", q: "Valve clearance specification" },
  { label: "PARTS", q: "Common replacement parts and part numbers" },
  { label: "PREVIOUS JOBS", q: "What work have we done on this model before?" },
  { label: "LABOUR", q: "What labour hours do we normally charge for this work?" },
];

export function McdTechProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<McdTechTarget>({ kind: "global" });
  const openWith = useCallback((t: McdTechTarget = { kind: "global" }) => {
    setTarget(t);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ open: openWith }), [openWith]);
  return (
    <McdTechCtl.Provider value={value}>
      {children}
      <McdTechDrawer open={open} onOpenChange={setOpen} target={target} />
    </McdTechCtl.Provider>
  );
}

/* ------------------------------------------------------------------ *
 * DRAWER
 * ------------------------------------------------------------------ */

function McdTechDrawer({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: McdTechTarget;
}) {
  const access = useMcdTechAccess();
  const [ctx, setCtx] = useState<McdContext>(EMPTY_CONTEXT);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState<{
    question: string;
    options: GenerationChoice[];
  } | null>(null);
  const [tab, setTab] = useState<"ask" | "notes" | "history">("ask");
  const conversationId = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Automatic context — the technician never retypes the motorcycle.
  useEffect(() => {
    if (!open) return;
    conversationId.current = null;
    setEntries([]);
    setPendingGeneration(null);
    setTab("ask");
    let alive = true;
    (async () => {
      let next = EMPTY_CONTEXT;
      try {
        if (target.kind === "job") next = await buildJobContext(target.jobId);
        else if (target.kind === "motorcycle") next = await buildMotorcycleContext(target.motorcycleId);
        else if (target.kind === "model") next = await buildModelContext(target.modelId);
      } catch {
        next = EMPTY_CONTEXT;
      }
      if (alive) setCtx(next);
    })();
    return () => {
      alive = false;
    };
  }, [open, target]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, busy]);

  const push = (e: Entry) => setEntries((prev) => [...prev, e]);
  const uid = () => Math.random().toString(36).slice(2);

  // The whole session is about one motorcycle — this line is sent with every
  // question so the assistant never asks "which bike?" again.
  const contextNote = useMemo(() => {
    const lines = [
      `Motorcycle: ${ctx.title}`,
      ctx.generation && ctx.generation !== "—" ? `Generation: ${ctx.generation}` : null,
      ctx.variant ? `Variant: ${ctx.variant}` : null,
      ctx.engine ? `Engine: ${ctx.engine}` : null,
      ctx.mileage ? `Odometer: ${ctx.mileage.toLocaleString()} km` : null,
      ctx.modifications ? `Modifications: ${ctx.modifications}` : null,
      ctx.jobNumber ? `Current job: #${ctx.jobNumber}${ctx.jobLabel ? ` · ${ctx.jobLabel}` : ""}` : null,
    ].filter(Boolean);
    return lines.length > 1 ? lines.join("\n") : lines[0] ?? null;
  }, [ctx]);

  // Running transcript so short follow-ups ("and the fork oil?") keep the thread.
  const thread = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  useEffect(() => {
    if (open) thread.current = [];
  }, [open, target]);

  async function runAsk(question: string, forcedModelId?: string | null) {
    if (!question.trim() || busy) return;
    setQ("");
    setPendingGeneration(null);
    const bike: McdContext = forcedModelId ? { ...ctx, modelId: forcedModelId } : ctx;

    // Safety gate: never silently answer with another generation's figures.
    if (!forcedModelId && isSafetySensitive(question)) {
      const options = await generationCandidates(ctx);
      if (options.length > 1) {
        push({ id: uid(), kind: "question", text: question });
        setPendingGeneration({ question, options });
        return;
      }
    }

    push({ id: uid(), kind: "question", text: question });
    setBusy(true);
    try {
      conversationId.current = await ensureConversation(ctx, conversationId.current);
      await saveMessage(conversationId.current, "user", question);
      const answer = await askTech(question, bike, {
        allowExternalAi: access.canUseExternalAi,
        history: thread.current.slice(-10),
        contextNote,
      });
      push({ id: uid(), kind: "answer", answer });
      const summary =
        answer.specs.map((s) => `${s.label}: ${s.value}`).join("\n") || answer.aiText || "No answer";
      thread.current = [
        ...thread.current,
        { role: "user", content: question },
        { role: "assistant", content: summary },
      ].slice(-12);
      await saveMessage(conversationId.current, "assistant", summary, { answer });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MCD TECH request failed");
    } finally {
      setBusy(false);
    }
  }

  async function currentJobSummary() {
    if (!ctx.jobId) return;
    setBusy(true);
    try {
      const s = await summariseJob(ctx.jobId);
      const body = [
        s.completed.length ? s.completed.map((t) => `✓ ${t}`).join("\n") : null,
        s.pending.length ? s.pending.map((t) => `○ ${t}`).join("\n") : null,
        s.waiting.length ? s.waiting.map((t) => `⚠ ${t}`).join("\n") : null,
      ]
        .filter(Boolean)
        .join("\n\n");
      push({
        id: uid(),
        kind: "text",
        title: "CURRENT JOB",
        body: body || "No tasks or findings recorded on this job yet.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!access.loading && !access.canUse) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-mono tracking-[0.2em]">MCD TECH</SheetTitle>
          </SheetHeader>
          <p className="mt-6 text-sm text-muted-foreground">
            MCD TECH is currently disabled for your account. An admin can change this in Settings → MCD TECH.
          </p>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3 space-y-1">
          <SheetTitle className="flex items-center gap-2 font-mono text-sm tracking-[0.25em]">
            <Wrench className="h-4 w-4 text-amber-400" /> MCD TECH
          </SheetTitle>
          <div className="text-xs font-mono text-muted-foreground">
            {ctx.title}
            {ctx.subtitle ? ` · ${ctx.subtitle}` : ""}
            {ctx.generation && ctx.generation !== "—" ? ` · ${ctx.generation}` : ""}
            {ctx.mileage ? ` · ${ctx.mileage.toLocaleString()} km` : ""}
          </div>
          {ctx.modifications ? (
            <div className="text-[0.65rem] text-amber-400/80">Modifications: {ctx.modifications}</div>
          ) : null}
          <div className="flex gap-1 pt-1">
            {(
              [
                ["ask", "Ask", MessageSquare],
                ["notes", "Write", Sparkles],
                ["history", "History", HistoryIcon],
              ] as const
            ).map(([k, label, Icon]) => (
              <Button
                key={k}
                size="sm"
                variant={tab === k ? "secondary" : "ghost"}
                className="h-7 text-xs gap-1"
                onClick={() => setTab(k)}
              >
                <Icon className="h-3 w-3" />
                {label}
              </Button>
            ))}
          </div>
        </SheetHeader>

        {tab === "ask" && (
          <>
            <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
              {QUICK_ACTIONS.map((a) => (
                <Button
                  key={a.label}
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[0.6rem] font-mono tracking-wider"
                  disabled={busy}
                  onClick={() => void runAsk(a.q)}
                >
                  {a.label}
                </Button>
              ))}
              {ctx.jobId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[0.6rem] font-mono tracking-wider gap-1"
                  disabled={busy}
                  onClick={() => void currentJobSummary()}
                >
                  <ClipboardList className="h-3 w-3" /> CURRENT JOB
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3">
                {entries.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Verified workshop knowledge is searched first. External AI is only used when nothing
                    internal matches, and is always labelled unverified.
                  </p>
                )}
                {entries.map((e) =>
                  e.kind === "question" ? (
                    <div key={e.id} className="text-right">
                      <span className="inline-block rounded-md bg-secondary px-3 py-1.5 text-sm">{e.text}</span>
                    </div>
                  ) : e.kind === "answer" ? (
                    <AnswerCard key={e.id} answer={e.answer} modelId={ctx.modelId ?? null} />
                  ) : (
                    <div key={e.id} className="card-surface p-3">
                      <div className="text-[0.6rem] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-1">
                        {e.title}
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-sm">{e.body}</pre>
                    </div>
                  ),
                )}

                {pendingGeneration && (
                  <div className="card-surface border-amber-500/40 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-mono uppercase tracking-widest">
                      <AlertTriangle className="h-4 w-4" /> Confirm generation
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Multiple generations found for this motorcycle. Safety-critical specifications are not
                      returned until the generation is confirmed.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {pendingGeneration.options.map((o) => (
                        <Button
                          key={o.id}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => void runAsk(pendingGeneration.question, o.id)}
                        >
                          {o.label} · {o.years}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {busy && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching workshop knowledge…
                  </div>
                )}
                <div ref={bottom} />
              </div>
            </ScrollArea>

            <form
              className="flex gap-2 border-t border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void runAsk(q);
              }}
            >
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ask MCD TECH…"
                className="text-sm"
              />
              <Button type="submit" size="icon" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </>
        )}

        {tab === "notes" && (
          <WritePanel
            bikeLabel={ctx.title}
            allowCustomerText={access.canGenerateCustomerText}
            allowAi={access.canUseExternalAi}
          />
        )}

        {tab === "history" && <HistoryPanel />}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ *
 * WRITE PANEL — note clean-up + customer explanation
 * ------------------------------------------------------------------ */

function WritePanel({
  bikeLabel,
  allowCustomerText,
  allowAi,
}: {
  bikeLabel: string;
  allowCustomerText: boolean;
  allowAi: boolean;
}) {
  const [text, setText] = useState("");
  const [suggestion, setSuggestion] = useState<{ kind: "note" | "customer"; body: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(kind: "note" | "customer") {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res =
        kind === "note"
          ? await cleanTechnicianNote({ data: { text } })
          : await explainToCustomer({ data: { note: text, bike: bikeLabel } });
      setSuggestion({ kind, body: (res as any).suggestion ?? "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-3">
      <div className="text-[0.6rem] font-mono uppercase tracking-[0.25em] text-muted-foreground">
        Your text (never overwritten)
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="chain rooted rear pads low fork seal leaking"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || !allowAi} onClick={() => void run("note")} className="gap-1">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Clean up wording
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !allowCustomerText}
          onClick={() => void run("customer")}
          className="gap-1"
        >
          <Bot className="h-3 w-3" /> Explain to customer
        </Button>
      </div>
      {!allowAi && (
        <p className="text-xs text-muted-foreground">AI writing assistance is disabled in Settings → MCD TECH.</p>
      )}
      {suggestion && (
        <div className="card-surface p-3 space-y-2">
          <div className="text-[0.6rem] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            {suggestion.kind === "note" ? "Suggested workshop wording" : "Suggested customer explanation"} · review
            before use
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm">{suggestion.body}</pre>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(suggestion.body);
              toast.success("Copied — paste it where you need it");
            }}
          >
            Copy
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * HISTORY PANEL
 * ------------------------------------------------------------------ */

function HistoryPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    void listConversations().then(setRows);
  }, []);

  useEffect(() => {
    if (openId) void loadConversation(openId).then(setMessages);
    else setMessages([]);
  }, [openId]);

  return (
    <div className="flex-1 overflow-auto p-4 space-y-2">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No saved MCD TECH sessions yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="card-surface p-2">
          <button
            className="w-full text-left"
            onClick={() => setOpenId(openId === r.id ? null : r.id)}
          >
            <div className="text-sm">{r.context_label || r.title}</div>
            <div className="text-[0.65rem] font-mono text-muted-foreground">
              {new Date(r.updated_at).toLocaleString("en-NZ")}
            </div>
          </button>
          {openId === r.id && (
            <div className="mt-2 space-y-1 border-t border-border pt-2">
              {messages.map((m) => (
                <div key={m.id} className="text-xs">
                  <span className="font-mono uppercase text-muted-foreground mr-2">
                    {m.role === "user" ? "Q" : m.used_external_ai ? "AI" : "MCD"}
                  </span>
                  <span className="whitespace-pre-wrap">{m.content}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * TRIGGER BUTTON
 * ------------------------------------------------------------------ */

export function AskMcdTechButton({
  target,
  size = "sm",
  variant = "outline",
  className,
  label = "Ask MCD TECH",
}: {
  target: McdTechTarget;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "secondary" | "ghost" | "default";
  className?: string;
  label?: string;
}) {
  const { open } = useMcdTech();
  const { canUse, loading } = useMcdTechAccess();
  if (loading || !canUse) return null;
  return (
    <Button size={size} variant={variant} className={className} onClick={() => open(target)}>
      <Wrench className="h-4 w-4 mr-1 text-amber-400" />
      {label}
    </Button>
  );
}
