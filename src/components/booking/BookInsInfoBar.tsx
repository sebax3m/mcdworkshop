import { Truck } from "lucide-react";

import { BOOK_IN_STATUS, BOOK_IN_STATUS_PRIMARY, statusStyle } from "@/lib/book-in-status";
import { cn } from "@/lib/utils";

function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-[color:var(--bookin-line)] bg-[color:var(--bookin-panel)] px-3.5 py-3",
        className,
      )}
    >
      <div className="mb-2.5 text-[0.625rem] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
        {title}
      </div>
      {children}
    </div>
  );
}

/** Operational status legend — icons, labels and short descriptions. */
export function BookInLegend() {
  return (
    <Panel title="Book-in status">
      <ul className="grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {BOOK_IN_STATUS_PRIMARY.map((k) => {
          const s = BOOK_IN_STATUS[k];
          const Icon = s.icon;
          return (
            <li key={k} className="flex min-w-0 items-center gap-2">
              <span
                style={statusStyle.iconBox(s.color)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[0.6875rem] font-semibold text-foreground">
                  {s.label}
                </span>
                <span className="block truncate text-[0.625rem] text-muted-foreground/70">
                  {s.hint}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Transport legend — independent of workflow status. */
export function TransportLegend() {
  return (
    <Panel title="Pick-up / drop-off">
      <ul className="space-y-2">
        {["Drop-off", "Pick-up"].map((label) => (
          <li key={label} className="flex items-center gap-2">
            <span className="grid h-[1.05rem] w-[1.05rem] shrink-0 place-items-center rounded bg-[#3B82F6] text-white">
              <Truck className="h-3 w-3" />
            </span>
            <span className="text-[0.6875rem] text-muted-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const INDICATORS: { color: string; label: string }[] = [
  { color: "#F59E0B", label: "Loan bike out" },
  { color: "#D946EF", label: "Loan bike" },
  { color: "#9CA3AF", label: "Has notes" },
];

/** Small dot indicators that appear on cards when real data supports them. */
export function CardIndicatorLegend() {
  return (
    <Panel title="Card indicators">
      <ul className="space-y-2">
        {INDICATORS.slice(1).map((i) => (
          <li key={i.label} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={statusStyle.dot(i.color)}
            />
            <span className="text-[0.6875rem] text-muted-foreground">{i.label}</span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="rounded-[4px] bg-white/[0.07] px-1 py-[1px] font-mono text-[0.5625rem] font-bold uppercase tracking-wider text-foreground/70">
            REGO
          </span>
          <span className="text-[0.6875rem] text-muted-foreground">Registration</span>
        </li>
      </ul>
    </Panel>
  );
}

/** Semicircular daily capacity gauge (pure SVG). */
export function DailyCapacityGauge({
  booked,
  capacity,
  label,
}: {
  booked: number;
  capacity: number;
  label?: string;
}) {
  const pct = capacity > 0 ? (booked / capacity) * 100 : booked > 0 ? 100 : 0;
  const clamped = Math.min(100, pct);
  const color = pct >= 100 ? "#EF4444" : pct >= 75 ? "#F59E0B" : "#22C55E";
  const state = pct >= 100 ? "At capacity" : pct >= 75 ? "Approaching capacity" : "Normal capacity";
  const r = 52;
  const arc = Math.PI * r;

  return (
    <Panel title="Daily capacity">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 130 72" className="h-[62px] w-[112px] shrink-0">
          <path
            d="M 13 65 A 52 52 0 0 1 117 65"
            fill="none"
            stroke="var(--bookin-line)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M 13 65 A 52 52 0 0 1 117 65"
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * arc} ${arc}`}
          />
        </svg>
        <div className="min-w-0">
          <div className="text-lg font-bold leading-none tabular-nums" style={{ color }}>
            {booked} / {capacity}
          </div>
          <div className="mt-1 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
            {Math.round(pct)}%
          </div>
          <div className="mt-0.5 truncate text-[0.625rem] text-muted-foreground/70">{state}</div>
          {label && (
            <div className="mt-0.5 text-[0.5625rem] uppercase tracking-wider text-muted-foreground/50">
              {label}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** Bottom operational information area under the calendar. */
export function BookInsInfoBar({
  booked,
  capacity,
  dayLabel,
}: {
  booked: number;
  capacity: number;
  dayLabel?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,3.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
      <BookInLegend />
      <TransportLegend />
      <CardIndicatorLegend />
      <DailyCapacityGauge booked={booked} capacity={capacity} label={dayLabel} />
    </div>
  );
}
