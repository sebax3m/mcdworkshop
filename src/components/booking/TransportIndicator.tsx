import { Truck } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddressMap } from "@/components/booking/AddressAutocomplete";
import { cn } from "@/lib/utils";

export type TransportKind = "pickup" | "dropoff" | "both" | null;

export function transportKind(b: {
  pickup_required?: boolean | null;
  delivery_required?: boolean | null;
}): TransportKind {
  if (b?.pickup_required && b?.delivery_required) return "both";
  if (b?.pickup_required) return "pickup";
  if (b?.delivery_required) return "dropoff";
  return null;
}

export function transportLabel(kind: TransportKind): string {
  return kind === "both"
    ? "Pick-up & drop-off"
    : kind === "pickup"
      ? "Pick-up"
      : kind === "dropoff"
        ? "Drop-off"
        : "";
}

/**
 * Blue transport chip — always visible, independent of workflow status.
 * Click opens the address + embedded map, so the card size never changes.
 */
export function TransportIndicator({
  kind,
  address,
  className,
}: {
  kind: TransportKind;
  address?: string | null;
  className?: string;
}) {
  if (!kind) return null;
  const label = transportLabel(kind);
  const hint =
    kind === "both"
      ? "PICK-UP & DROP-OFF"
      : kind === "pickup"
        ? "PICK-UP REQUIRED"
        : "DROP-OFF REQUIRED";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={hint}
          className={cn(
            "z-10 inline-flex h-[1.05rem] w-[1.05rem] shrink-0 items-center justify-center rounded bg-sky-500 text-white shadow transition-colors hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300",
            className,
          )}
        >
          <Truck className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={6}
        className="w-80 p-3 sm:w-96"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4 text-sky-500" />
            {label}
          </div>
          <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>
          {address ? (
            <>
              <p className="text-xs text-muted-foreground">{address}</p>
              <AddressMap address={address} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No address provided.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
