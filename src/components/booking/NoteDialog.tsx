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
import { Trash2, StickyNote } from "lucide-react";
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

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
  }, [open, note]);

  const editing = !!note;

  async function save() {
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

  async function remove() {
    if (!note) return;
    if (!window.confirm("Delete this note?")) return;
    try {
      await del.mutateAsync(note.id);
      toast.success("Note deleted");
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
        </div>

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
              disabled={!title.trim() || create.isPending || update.isPending}
            >
              {editing ? "Save" : "Add note"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
