/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addDays, format, isValid, parseISO } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  StickyNote,
  CalendarDays,
  ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BookInCard, CapacityBadge } from "@/components/booking/BookInCard";
import { NoteDialog } from "@/components/booking/NoteDialog";
import { useDailyNotesForDate, type DailyNote } from "@/hooks/useDailyNotes";
import { useWorkshopCapacity } from "@/hooks/useWorkshopCapacity";
import { bookInStage } from "@/lib/workshop-status";
import { TechnicianLoad } from "@/components/booking/TechnicianLoad";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/book-ins/$date")({
  head: () => ({
    meta: [
      { title: "Day book-ins — Motorcycle Doctors Workshop" },
      {
        name: "description",
        content: "Every motorcycle booked into the workshop for the selected day.",
      },
      { property: "og:title", content: "Day book-ins — Motorcycle Doctors Workshop" },
      {
        property: "og:description",
        content: "Every motorcycle booked into the workshop for the selected day.",
      },
    ],
  }),
  component: DayView,
});

export function useDayBookings(dateStr: string) {
  return useQuery({
    queryKey: ["day-bookings", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, service_type, service_type_other, scheduled_date, drop_off_time, estimated_hours, status, confirmed, bike_arrived, bike_arrived_at, loan_bike, job_id, notes, complaints, rego, customer_id, motorcycle_id, assigned_tech_id, customers(first_name,last_name,phone), motorcycles(year,make,model,rego,photos)",
        )

        .eq("scheduled_date", dateStr)
        .order("drop_off_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!dateStr,
  });
}

/** Insertion indicator shown while dragging a book-in. */
function DropLine() {
  return (
    <div className="relative h-0.5 my-1 rounded-full bg-primary">
      <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-primary" />
    </div>
  );
}

function DayView() {
  const { date } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const parsed = parseISO(date);
  const day = isValid(parsed) ? parsed : new Date();
  const dateStr = format(day, "yyyy-MM-dd");

  const { data: bookings = [], isLoading } = useDayBookings(dateStr);
  const notesQ = useDailyNotesForDate(dateStr);
  const { capacityFor } = useWorkshopCapacity();
  const capacity = capacityFor(day);

  const [noteOpen, setNoteOpen] = useState(false);
  const [editNote, setEditNote] = useState<DailyNote | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const groups = {
    waiting_inspection: (bookings as any[]).filter((b) => bookInStage(b) === "waiting_inspection"),
    arrived: (bookings as any[]).filter((b) => bookInStage(b) === "arrived"),
    in_workshop: (bookings as any[]).filter((b) => bookInStage(b) === "in_workshop"),
    booked: (bookings as any[]).filter((b) => bookInStage(b) === "booked"),
  };

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["day-bookings"] });
    qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
    qc.invalidateQueries({ queryKey: ["today-bookings"] });
  }

  async function checkIn(b: any) {
    const { error } = await supabase
      .from("bookings")
      .update({ bike_arrived: true, bike_arrived_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Checked in");
    invalidate();
  }

  /** Move a booking between the day columns via drag & drop. */
  async function moveTo(
    b: any,
    target: "booked" | "arrived" | "waiting_inspection" | "in_workshop",
  ) {
    if (bookInStage(b) === target) return;

    if (target === "in_workshop") {
      if (b.job_id) return;
      toast.info("Create the job card to move it into the workshop");
      nav({ to: "/jobs/new", search: { bookingId: b.id } as never });
      return;
    }

    if (b.job_id) return toast.error("This book-in already has a job card");

    if (target === "arrived") {
      await checkIn(b);
      return;
    }

    // booked / waiting_inspection: both mean "not checked in yet"
    const { error } = await supabase
      .from("bookings")
      .update({ bike_arrived: false, bike_arrived_at: null })
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Check-in undone");
    invalidate();
  }

  const go = (delta: number) =>
    nav({
      to: "/book-ins/$date",
      params: { date: format(addDays(day, delta), "yyyy-MM-dd") },
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary/50"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => go(1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary/50"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold leading-tight">
              {format(day, "EEEE d MMMM")}
            </h1>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <CapacityBadge booked={bookings.length} capacity={capacity} />
              <span>book-ins</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditNote(null);
              setNoteOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 h-9 text-xs font-semibold uppercase tracking-wider hover:border-primary/50"
          >
            <StickyNote className="h-4 w-4" /> Day note
          </button>
          <Link
            to="/bookings/new"
            search={{ date: dateStr } as never}
            className="inline-flex items-center gap-1.5 rounded-lg red-surface px-3 h-9 text-xs font-bold uppercase tracking-wider"
          >
            <Plus className="h-4 w-4" /> New book-in
          </Link>
          <div className="inline-flex items-center rounded-lg border border-border p-0.5">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 text-primary px-3 h-8 text-xs font-bold uppercase tracking-wider">
              <ClipboardCheck className="h-4 w-4" /> Day
            </span>
            <Link
              to="/calendar"
              className="inline-flex items-center gap-1.5 rounded-md px-3 h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <CalendarDays className="h-4 w-4" /> Calendar
            </Link>
          </div>
        </div>
      </div>

      {/* Day notes */}
      {(notesQ.data ?? []).length > 0 && (
        <div className="space-y-2">
          {(notesQ.data ?? []).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setEditNote(n);
                setNoteOpen(true);
              }}
              className="w-full text-left rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
            >
              <div className="text-[0.625rem] font-bold uppercase tracking-wider text-amber-400">
                Workshop note
              </div>
              <div className="text-sm font-semibold">{n.title}</div>
              {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading book-ins…</div>
      ) : bookings.length === 0 ? (
        <div className="card-surface p-8 text-center space-y-3">
          <div className="text-sm text-muted-foreground">
            No motorcycles booked in for {format(day, "EEEE d MMMM")}
          </div>
          <Link
            to="/bookings/new"
            className="inline-flex items-center gap-1.5 rounded-lg red-surface px-3 h-9 text-xs font-bold uppercase tracking-wider"
          >
            <Plus className="h-4 w-4" /> New book-in
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["waiting_inspection", "Awaiting inspection", groups.waiting_inspection, true],
              ["arrived", "Arrived", groups.arrived, false],
              ["in_workshop", "In workshop", groups.in_workshop, false],
            ] as const
          ).map(([key, label, list, showCheckIn]) => (

            <section
              key={key}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverCol(key);
                setOverIdx((i) => (i === null ? list.length : i));
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setOverCol((c) => (c === key ? null : c));
                setOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                setOverIdx(null);
                const id = e.dataTransfer.getData("text/plain") || dragId;
                setDragId(null);
                const b = (bookings as any[]).find((x) => x.id === id);
                if (b) void moveTo(b, key);
              }}
              className={
                "card-surface p-3 space-y-2 transition-colors " +
                (overCol === key ? "ring-2 ring-primary/60 bg-primary/5" : "")
              }
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {label}
                </h2>
                <span className="text-xs font-bold tabular-nums text-muted-foreground">
                  {list.length}
                </span>
              </div>
              {list.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  {dragId && overCol === key ? (
                    <DropLine />
                  ) : dragId ? (
                    "Drop here"
                  ) : (
                    "Nothing here yet"
                  )}
                </div>
              ) : (
                list.map((b: any, idx: number) => (
                  <div
                    key={b.id}
                    className="space-y-1.5"
                    onDragOver={(e) => {
                      if (!dragId) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      setOverIdx(e.clientY < r.top + r.height / 2 ? idx : idx + 1);
                    }}
                  >
                    {dragId && overCol === key && overIdx === idx && <DropLine />}
                    <BookInCard
                      booking={b}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", b.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(b.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                        setOverIdx(null);
                      }}
                      className={dragId === b.id ? "opacity-50" : ""}
                      onClick={() =>
                        nav({ to: "/bookings/$bookingId", params: { bookingId: b.id } })
                      }
                    />
                    {dragId &&
                      overCol === key &&
                      overIdx === idx + 1 &&
                      idx === list.length - 1 && <DropLine />}

                    <div className="flex gap-1.5">
                      {showCheckIn && (
                        <button
                          onClick={() => checkIn(b)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 h-8 text-[0.6875rem] font-bold uppercase tracking-wider hover:border-primary/50"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" /> Check in
                        </button>
                      )}
                      {b.job_id && (
                        <Link
                          to="/jobs/$jobId"
                          params={{ jobId: b.job_id }}
                          className="flex-1 inline-flex items-center justify-center rounded-lg border border-border px-2 h-8 text-[0.6875rem] font-bold uppercase tracking-wider hover:border-primary/50"
                        >
                          Open job
                        </Link>
                      )}
                      {b.customers?.phone && (
                        <a
                          href={`tel:${b.customers.phone}`}
                          className="inline-flex items-center justify-center rounded-lg border border-border px-2 h-8 text-[0.6875rem] font-bold uppercase tracking-wider hover:border-primary/50"
                        >
                          Call
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </section>
          ))}

          <TechnicianLoad
            bookings={bookings as any[]}
            droppable
            onAssign={assignTech}
            onOpenBooking={(id) => nav({ to: "/bookings/$bookingId", params: { bookingId: id } })}
          />
        </div>

      )}

      <NoteDialog
        open={noteOpen}
        onOpenChange={(v) => {
          setNoteOpen(v);
          if (!v) setEditNote(null);
        }}
        date={dateStr}
        note={editNote}
      />
    </div>
  );
}
