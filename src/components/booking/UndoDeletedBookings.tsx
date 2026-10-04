import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ActivityLogView } from "@/components/ActivityLogView";

export function UndoDeletedBookings() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="ml-auto" onClick={() => setOpen(true)}>
        <Undo2 className="h-4 w-4" /> Undo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Restore a deleted book-in</DialogTitle>
            <DialogDescription>Pick the day it was deleted, then restore it to the calendar. Last 30 days.</DialogDescription>
          </DialogHeader>
          <ActivityLogView onlyDeleted tables={["bookings"]} />
        </DialogContent>
      </Dialog>
    </>
  );
}
