import { useState } from "react";
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
  useDailyNotesForDate,
  useUpdateDailyNote,
  type DailyNote,
} from "@/hooks/useDailyNotes";
import { dash } from "@/lib/display";

type Props = {
  date: string; // yyyy-mm-dd
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/**
 * Modal to add / edit / delete daily notes for a given date.
 * Notes do NOT block appointment slots.
 */
export function DailyNoteDialog({ date, open, onOpenChange }: Props) {
  const { data: notes = [] } = useDailyNotesForDate(date);
  const create = useCreateDailyNote();
  const update = useUpdateDailyNote();
  const del = useDeleteDailyNote();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function addNote() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      await create.mutateAsync({ note_date: date, title: title.trim(), body: body.trim() || null });
      setTitle("");
      setBody("");
      toast.success("Note added");
    } catch (e) {
      toast.error((e as Error).message ?? "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-500" />
            Day notes · {date}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              New note
            </Label>
            <Input
              placeholder="Short title (e.g. Public holiday)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Optional longer note"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={addNote} disabled={create.isPending || !title.trim()}>
                Add note
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {notes.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">
                No notes for this date yet.
              </div>
            ) : (
              notes.map((n) => (
                <EditableNote
                  key={n.id}
                  note={n}
                  onSave={async (title, body) => {
                    try {
                      await update.mutateAsync({ id: n.id, title, body });
                      toast.success("Note updated");
                    } catch (e) {
                      toast.error((e as Error).message ?? "Failed");
                    }
                  }}
                  onDelete={async () => {
                    if (!window.confirm("Delete this note?")) return;
                    try {
                      await del.mutateAsync(n.id);
                      toast.success("Note deleted");
                    } catch (e) {
                      toast.error((e as Error).message ?? "Failed");
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditableNote({
  note,
  onSave,
  onDelete,
}: {
  note: DailyNote;
  onSave: (title: string, body: string | null) => void;
  onDelete: () => void;
}) {
  const [t, setT] = useState(note.title);
  const [b, setB] = useState(dash(note.body, ""));
  const dirty = t !== note.title || b !== (note.body ?? "");
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <Input value={t} onChange={(e) => setT(e.target.value)} className="font-semibold" />
      <Textarea
        value={b}
        onChange={(e) => setB(e.target.value)}
        rows={2}
        placeholder="No additional details"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onDelete}
          className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive"
          title="Delete note"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <Button
          size="sm"
          variant="outline"
          disabled={!dirty || !t.trim()}
          onClick={() => onSave(t.trim(), b.trim() || null)}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
