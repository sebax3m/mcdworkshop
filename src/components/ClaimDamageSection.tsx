import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls, uploadPhoto } from "@/lib/photos";
import { AlertTriangle, Camera, Trash2, X, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type DamageMark = {
  id: string;
  view: "side" | "top";
  x: number; // 0-1
  y: number; // 0-1
  severity: "minor" | "moderate" | "severe";
  label?: string;
};

const SEVERITY: Record<DamageMark["severity"], { color: string; label: string }> = {
  minor:    { color: "#facc15", label: "Minor" },
  moderate: { color: "#f97316", label: "Moderate" },
  severe:   { color: "#ef4444", label: "Severe" },
};

const PRINT_PREFIX = "CLAIM_DAMAGE: ";

export function ClaimDamageSection({
  claimId,
  canEdit,
  initialMarks,
}: {
  claimId: string;
  canEdit: boolean;
  initialMarks?: DamageMark[];
}) {
  const qc = useQueryClient();
  const [view, setView] = useState<"side" | "top">("side");
  const [severity, setSeverity] = useState<DamageMark["severity"]>("moderate");
  const [marks, setMarks] = useState<DamageMark[]>(initialMarks ?? []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMarks(initialMarks ?? []);
    setDirty(false);
  }, [JSON.stringify(initialMarks)]);

  const photos = useQuery({
    queryKey: ["claim-damage-photos", claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_photos")
        .select("id, storage_path, caption, created_at")
        .ilike("caption", `${PRINT_PREFIX}${claimId}%`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const urls = await getSignedUrls(rows.map((r) => r.storage_path));
      return rows.map((r, i) => ({ ...r, url: urls[i] }));
    },
  });

  const viewMarks = useMemo(() => marks.filter((m) => m.view === view), [marks, view]);

  function handleCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!canEdit) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0.02 || x > 0.98 || y < 0.02 || y > 0.98) return;
    setMarks((m) => [...m, { id: crypto.randomUUID(), view, x, y, severity }]);
    setDirty(true);
  }

  function removeMark(id: string) {
    setMarks((m) => m.filter((x) => x.id !== id));
    setDirty(true);
  }
  function clearView() {
    setMarks((m) => m.filter((x) => x.view !== view));
    setDirty(true);
  }

  async function saveMarks() {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("insurance_claims")
        .update({ damage_marks: marks })
        .eq("id", claimId);
      if (error) throw error;
      setDirty(false);
      toast.success("Damage diagram saved");
      qc.invalidateQueries({ queryKey: ["insurance-claim", claimId] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      for (const f of files) {
        const path = await uploadPhoto(f, `claim-damage/${claimId}`);
        const { error } = await supabase.from("job_photos").insert({
          uploaded_by: uid,
          storage_path: path,
          caption: `${PRINT_PREFIX}${claimId} · ${f.name}`,
        } as any);
        if (error) throw error;
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded`);
      qc.invalidateQueries({ queryKey: ["claim-damage-photos", claimId] });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deletePhoto(id: string, path: string) {
    if (!confirm("Delete this photo?")) return;
    await supabase.storage.from("workshop-photos").remove([path]).catch(() => {});
    await supabase.from("job_photos").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["claim-damage-photos", claimId] });
  }

  return (
    <section className="card-surface p-4 sm:p-5 border-l-4 border-orange-500/60 print:break-inside-avoid print:border-0 print:p-0 print:bg-transparent">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500/15 text-orange-400 print:hidden">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">Collision</div>
            <h2 className="font-display text-lg font-semibold">Damage diagram</h2>
          </div>
        </div>
        {canEdit && dirty && (
          <Button onClick={saveMarks} disabled={saving} size="sm" className="gold-surface gap-2 print:hidden">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save diagram"}
          </Button>
        )}
      </div>

      {/* Controls (screen only) */}
      <div className="flex items-center gap-2 flex-wrap mb-3 print:hidden">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(["side", "top"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "side" ? "Side view" : "Top view"}
            </button>
          ))}
        </div>
        {canEdit && (
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {(Object.keys(SEVERITY) as DamageMark["severity"][]).map((s) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition flex items-center gap-1.5 ${
                  severity === s ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                style={severity === s ? { boxShadow: `inset 0 0 0 2px ${SEVERITY[s].color}` } : undefined}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY[s].color }} />
                {SEVERITY[s].label}
              </button>
            ))}
          </div>
        )}
        {canEdit && viewMarks.length > 0 && (
          <button onClick={clearView} className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
            <RotateCcw className="h-3.5 w-3.5" /> Clear {view}
          </button>
        )}
      </div>

      {/* Interactive diagram (screen only) */}
      <div className="relative rounded-xl border border-border bg-gradient-to-br from-background to-card overflow-hidden print:hidden">
        <svg
          viewBox="0 0 600 320"
          className={`w-full h-auto ${canEdit ? "cursor-crosshair" : ""}`}
          onClick={handleCanvasClick}
        >
          {view === "side" ? <BikeSide /> : <BikeTop />}
          {viewMarks.map((m, i) => (
            <g key={m.id} className="pointer-events-auto">
              <circle cx={m.x * 600} cy={m.y * 320} r={14} fill={SEVERITY[m.severity].color} fillOpacity={0.85} stroke="white" strokeWidth={2} />
              <text x={m.x * 600} y={m.y * 320 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="white" style={{ pointerEvents: "none" }}>{i + 1}</text>
              {canEdit && (
                <g onClick={(e) => { e.stopPropagation(); removeMark(m.id); }} className="cursor-pointer" transform={`translate(${m.x * 600 + 12}, ${m.y * 320 - 14})`}>
                  <circle r={7} fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth={1.5} />
                  <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" stroke="hsl(var(--destructive))" strokeWidth={1.5} />
                </g>
              )}
            </g>
          ))}
        </svg>
        {canEdit && viewMarks.length === 0 && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-xs uppercase tracking-wider text-muted-foreground bg-background/70 backdrop-blur px-3 py-1.5 rounded-full">
              Tap the bike to mark damage
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {marks.length > 0 && (
        <div className="mt-3 grid sm:grid-cols-2 gap-2 print:hidden">
          {marks.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-xs">
              <span className="grid h-6 w-6 place-items-center rounded-full text-white font-bold text-[11px] shrink-0" style={{ background: SEVERITY[m.severity].color }}>{i + 1}</span>
              <span className="font-semibold capitalize">{m.severity}</span>
              <span className="text-muted-foreground">· {m.view} view</span>
              {canEdit && (
                <button onClick={() => removeMark(m.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Photos */}
      <div className="mt-5 print:hidden">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Damage photos</h3>
          {canEdit && (
            <>
              <input ref={fileRef} type="file" multiple accept="image/*" capture="environment" onChange={handleUpload} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} size="sm" variant="outline" className="gap-2">
                <Camera className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Add photos"}
              </Button>
            </>
          )}
        </div>
        {photos.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (photos.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No damage photos yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {(photos.data ?? []).map((p: any) => (
              <div key={p.id} className="relative group rounded-lg overflow-hidden border border-border bg-card aspect-square">
                <img src={p.url} alt={p.caption ?? ""} className="w-full h-full object-cover" loading="lazy" />
                {canEdit && (
                  <button onClick={() => deletePhoto(p.id, p.storage_path)} className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-background/80 backdrop-blur text-destructive opacity-0 group-hover:opacity-100 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Print-only worksheet: both views side-by-side, clean black-on-white, with space to write */}
      <div className="hidden print:block">
        <PrintDiagram title="Side view" marks={marks.filter((m) => m.view === "side")}>
          <BikeSidePrint />
        </PrintDiagram>
        <PrintDiagram title="Top view" marks={marks.filter((m) => m.view === "top")}>
          <BikeTopPrint />
        </PrintDiagram>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            Damage notes (panel · severity · description)
          </div>
          {Array.from({ length: Math.max(6, marks.length) }).map((_, i) => {
            const m = marks[i];
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderBottom: "1px solid #000",
                  padding: "6px 0",
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: "1.5px solid #000",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 10,
                  }}
                >
                  {i + 1}
                </span>
                {m ? (
                  <span>
                    <b style={{ textTransform: "capitalize" }}>{m.severity}</b> · {m.view} view
                  </span>
                ) : (
                  <span style={{ color: "#666" }}>__________________________________________________</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PrintDiagram({
  title,
  marks,
  children,
}: {
  title: string;
  marks: DamageMark[];
  children: React.ReactNode;
}) {
  return (
    <div style={{ pageBreakInside: "avoid", marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {title}
      </div>
      <svg viewBox="0 0 600 320" style={{ width: "100%", height: "auto", border: "1px solid #000" }}>
        {children}
        {marks.map((m, i) => (
          <g key={m.id}>
            <circle cx={m.x * 600} cy={m.y * 320} r={13} fill="white" stroke="#000" strokeWidth={2} />
            <text x={m.x * 600} y={m.y * 320 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#000">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// --- SVG bike views (screen, themed) -------------------------------------

function BikeSide() {
  return (
    <g fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={130} cy={240} r={55} />
      <circle cx={470} cy={240} r={55} />
      <circle cx={130} cy={240} r={18} fill="hsl(var(--muted))" />
      <circle cx={470} cy={240} r={18} fill="hsl(var(--muted))" />
      <line x1={130} y1={240} x2={170} y2={130} />
      <line x1={170} y1={130} x2={210} y2={110} />
      <line x1={210} y1={110} x2={245} y2={80} />
      <line x1={235} y1={75} x2={260} y2={75} />
      <circle cx={200} cy={140} r={18} fill="hsl(var(--muted))" />
      <path d="M 240 135 Q 290 110 340 130 L 350 165 L 245 170 Z" fill="hsl(var(--card))" />
      <path d="M 345 145 Q 410 138 445 155 L 420 175 L 340 170 Z" fill="hsl(var(--card))" />
      <path d="M 440 155 L 480 145 L 495 175 L 445 175 Z" fill="hsl(var(--card))" />
      <rect x={265} y={170} width={110} height={60} rx={8} fill="hsl(var(--muted))" />
      <line x1={280} y1={185} x2={360} y2={185} />
      <line x1={280} y1={200} x2={360} y2={200} />
      <line x1={280} y1={215} x2={360} y2={215} />
      <path d="M 370 215 L 460 230 L 470 245 L 380 235 Z" fill="hsl(var(--muted))" />
      <line x1={370} y1={220} x2={470} y2={240} />
      <g fontSize={9} fill="hsl(var(--muted-foreground))" stroke="none" textAnchor="middle">
        <text x={200} y={170}>Front</text>
        <text x={470} y={310}>Rear wheel</text>
        <text x={130} y={310}>Front wheel</text>
        <text x={465} y={140}>Tail</text>
      </g>
    </g>
  );
}

function BikeTop() {
  return (
    <g fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={300} y1={50} x2={300} y2={270} strokeDasharray="6 6" stroke="hsl(var(--border))" />
      <rect x={285} y={50} width={30} height={50} rx={6} fill="hsl(var(--muted))" />
      <line x1={220} y1={110} x2={380} y2={110} />
      <circle cx={220} cy={110} r={6} fill="hsl(var(--muted))" />
      <circle cx={380} cy={110} r={6} fill="hsl(var(--muted))" />
      <path d="M 260 105 Q 300 90 340 105 L 340 140 L 260 140 Z" fill="hsl(var(--card))" />
      <path d="M 260 140 Q 300 130 340 140 L 348 185 L 252 185 Z" fill="hsl(var(--card))" />
      <path d="M 258 185 L 342 185 L 335 230 L 265 230 Z" fill="hsl(var(--muted))" />
      <path d="M 270 230 L 330 230 L 322 265 L 278 265 Z" fill="hsl(var(--card))" />
      <circle cx={205} cy={100} r={10} fill="hsl(var(--card))" />
      <circle cx={395} cy={100} r={10} fill="hsl(var(--card))" />
      <rect x={285} y={265} width={30} height={45} rx={6} fill="hsl(var(--muted))" />
      <g fontSize={9} fill="hsl(var(--muted-foreground))" stroke="none" textAnchor="middle">
        <text x={300} y={42}>Front</text>
        <text x={300} y={305}>Rear</text>
        <text x={180} y={114}>L</text>
        <text x={420} y={114}>R</text>
      </g>
    </g>
  );
}

// --- Print versions (black on white) -------------------------------------

function BikeSidePrint() {
  return (
    <g fill="none" stroke="#000" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={130} cy={240} r={55} />
      <circle cx={470} cy={240} r={55} />
      <circle cx={130} cy={240} r={18} />
      <circle cx={470} cy={240} r={18} />
      <line x1={130} y1={240} x2={170} y2={130} />
      <line x1={170} y1={130} x2={210} y2={110} />
      <line x1={210} y1={110} x2={245} y2={80} />
      <line x1={235} y1={75} x2={260} y2={75} />
      <circle cx={200} cy={140} r={18} />
      <path d="M 240 135 Q 290 110 340 130 L 350 165 L 245 170 Z" />
      <path d="M 345 145 Q 410 138 445 155 L 420 175 L 340 170 Z" />
      <path d="M 440 155 L 480 145 L 495 175 L 445 175 Z" />
      <rect x={265} y={170} width={110} height={60} rx={8} />
      <line x1={280} y1={185} x2={360} y2={185} />
      <line x1={280} y1={200} x2={360} y2={200} />
      <line x1={280} y1={215} x2={360} y2={215} />
      <path d="M 370 215 L 460 230 L 470 245 L 380 235 Z" />
      <line x1={370} y1={220} x2={470} y2={240} />
      <g fontSize={9} fill="#000" stroke="none" textAnchor="middle">
        <text x={200} y={170}>Front</text>
        <text x={470} y={310}>Rear wheel</text>
        <text x={130} y={310}>Front wheel</text>
        <text x={465} y={140}>Tail</text>
      </g>
    </g>
  );
}

function BikeTopPrint() {
  return (
    <g fill="none" stroke="#000" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <line x1={300} y1={50} x2={300} y2={270} strokeDasharray="6 6" />
      <rect x={285} y={50} width={30} height={50} rx={6} />
      <line x1={220} y1={110} x2={380} y2={110} />
      <circle cx={220} cy={110} r={6} />
      <circle cx={380} cy={110} r={6} />
      <path d="M 260 105 Q 300 90 340 105 L 340 140 L 260 140 Z" />
      <path d="M 260 140 Q 300 130 340 140 L 348 185 L 252 185 Z" />
      <path d="M 258 185 L 342 185 L 335 230 L 265 230 Z" />
      <path d="M 270 230 L 330 230 L 322 265 L 278 265 Z" />
      <circle cx={205} cy={100} r={10} />
      <circle cx={395} cy={100} r={10} />
      <rect x={285} y={265} width={30} height={45} rx={6} />
      <g fontSize={9} fill="#000" stroke="none" textAnchor="middle">
        <text x={300} y={42}>Front</text>
        <text x={300} y={305}>Rear</text>
        <text x={180} y={114}>L</text>
        <text x={420} y={114}>R</text>
      </g>
    </g>
  );
}
