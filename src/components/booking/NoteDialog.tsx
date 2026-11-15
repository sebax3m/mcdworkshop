import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, StickyNote, CalendarRange } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { noteDateRange } from "@/lib/note-date-range";

const PRESETS = ["Annual Leave", "Holidays", "Sick Day", "Doctor Appointment", "Training / Off-site"];
import { toast } from "sonner";
import {
  useCreateDailyNote,
  useDeleteDailyNote,
  useUpdateDailyNote,
  type DailyNote,
} from "@/hooks/useDailyNotes";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Create mode: date + time of the clicked slot */
  date: string; // yyyy-mm-dd
  time?: string | null; // HH:mm
  /** Edit mode: existing note */
  note?: DailyNote | null;
};

/** Create or edit a single calendar note (placed at a specific day + time). */
export function NoteDialog({ open, onOpenChange, date, time, note }: Props) {
  const create = useCreateDailyNote();
  const update = useUpdateDailyNote();
  const del = useDeleteDailyNote();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [worker, setWorker] = useState("");
  const [rangeOn, setRangeOn] = useState(false);
  const [endDate, setEndDate] = useState(date);
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setWorker("");
    setRangeOn(false);
    setEndDate(note?.note_date ?? date);
    setWeekdaysOnly(true);
    setRelated(null);
  }, [open, note, date]);

  const editing = !!note;
  const startDate = note?.note_date ?? date;
  const rangeDays = rangeOn ? noteDateRange(startDate, endDate, weekdaysOnly) : [];

  function applyPreset(p: string) {
    setTitle(worker.trim() ? `${worker.trim()} — ${p}` : p);
  }

  /** Insert one note per day of the range (skipping the note's own day when copying). */
  async function saveRange() {
    if (!title.trim()) return toast.error("Title is required");
    const days = rangeDays.filter((d) => !(editing && d === note!.note_date));
    if (!days.length) return toast.error("Choose an end date after the start date");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      if (editing && note) {
        await update.mutateAsync({ id: note.id, title: title.trim(), body: body.trim() || null });
      }
      const t = note?.note_time ?? (time ? `${time}:00`.slice(0, 8) : null);
      const rows = days.map((d) => ({ note_date: d, note_time: t, title: title.trim(), body: body.trim() || null, created_by: user.id }));
      const { error } = await supabase.from("daily_notes").insert(rows);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["daily-notes"] });
      qc.invalidateQueries({ queryKey: ["daily-notes-day"] });
      toast.success(`Note added to ${days.length + (editing ? 1 : 0)} days`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (rangeOn) return saveRange();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      if (editing && note) {
        await update.mutateAsync({ id: note.id, title: title.trim(), body: body.trim() || null });
        toast.success("Note updated");
      } else {
        await create.mutateAsync({
          note_date: date,
          note_time: time ? `${time}:00`.slice(0, 8) : null,
          title: title.trim(),
          body: body.trim() || null,
        });
        toast.success("Note added");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message ?? "Failed");
    }
  }

  const [related, setRelated] = useState<string[] | null>(null);

  /** Find upcoming notes with the same title that continue this run of days (gaps up to 3 days, e.g. weekends). */
  async function remove() {
    if (!note) return;
    const { data, error } = await supabase
      .from("daily_notes")
      .select("id, note_date")
      .eq("title", note.title)
      .gt("note_date", note.note_date)
      .order("note_date", { ascending: true })
      .limit(400);
    if (error) return toast.error(error.message);
    const ids: string[] = [];
    let prev = new Date(`${note.note_date}T00:00:00Z`).getTime();
    for (const r of data ?? []) {
      const t = new Date(`${r.note_date}T00:00:00Z`).getTime();
      if (t - prev > 3 * 86400000) break;
      ids.push(r.id);
      prev = t;
    }
    setRelated(ids);
  }

  async function confirmDelete(withRelated: boolean) {
    if (!note) return;
    try {
      const ids = [note.id, ...(withRelated ? related ?? [] : [])];
      const { error } = await supabase.from("daily_notes").delete().in("id", ids);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["daily-notes"] });
      qc.invalidateQueries({ queryKey: ["daily-notes-day"] });
      setRelated(null);
      toast.success(ids.length > 1 ? `${ids.length} notes deleted` : "Note deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message ?? "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-500" />
            {editing ? "Edit note" : "New note"} · {note?.note_date ?? date}
            {(note?.note_time ?? time) ? ` · ${String(note?.note_time ?? time).slice(0, 5)}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Staff away / event</Label>
          <Input placeholder="Worker name (optional, e.g. Shaun)" value={worker} onChange={(e) => setWorker(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => applyPreset(p)}>{p}</Button>
            ))}
          </div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
          <Input
            autoFocus
            placeholder="Short title (e.g. Public holiday)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
          />
          <Textarea
            placeholder="Optional longer note"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <div className="rounded-md border border-border p-2 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={rangeOn} onChange={(e) => setRangeOn(e.target.checked)} />
              <CalendarRange className="h-4 w-4" /> {editing ? "Copy / extend to more days" : "Several days (date range)"}
            </label>
            {rangeOn && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={startDate} disabled /></div>
                  <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={weekdaysOnly} onChange={(e) => setWeekdaysOnly(e.target.checked)} /> Monday to Friday only
                </label>
                <p className="text-xs text-muted-foreground">Will show on {rangeDays.length} day{rangeDays.length === 1 ? "" : "s"}.</p>
              </div>
            )}
          </div>
        </div>

        {related && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-2">
            <p className="text-sm font-medium">
              {related.length
                ? `There ${related.length === 1 ? "is 1 upcoming related note" : `are ${related.length} upcoming related notes`} ("${note?.title}"). What do you want to delete?`
                : "Delete this note?"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="destructive" onClick={() => confirmDelete(false)}>Only this day</Button>
              {related.length > 0 && (
                <Button size="sm" variant="destructive" onClick={() => confirmDelete(true)}>This + {related.length} upcoming</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setRelated(null)}>Cancel</Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div>
            {editing && (
              <button
                onClick={remove}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!title.trim() || busy || create.isPending || update.isPending}
            >
              {rangeOn ? `Add to ${rangeDays.length} days` : editing ? "Save" : "Add note"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
