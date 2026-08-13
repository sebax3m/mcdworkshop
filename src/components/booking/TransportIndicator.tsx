import { Clock, MapPin, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RouteMap } from "@/components/booking/AddressAutocomplete";
import { getEta } from "@/lib/maps.functions";
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
 * Click opens the address + embedded map + ETA from the workshop, so the card size never changes.
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
  const label = transportLabel(kind);
  const hint =
    kind === "both"
      ? "PICK-UP & DROP-OFF"
      : kind === "pickup"
        ? "PICK-UP REQUIRED"
        : "DROP-OFF REQUIRED";

  const { data: eta, isLoading } = useQuery({
    queryKey: ["transport-eta", address],
    queryFn: async () => {
      if (!address) return null;
      return getEta({ data: { destination: address } });
    },
    enabled: !!kind && !!address && address.trim().length > 5,
    staleTime: 5 * 60 * 1000,
  });

  if (!kind) return null;


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
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-snug text-foreground">{address}</p>
              </div>
              {isLoading ? (
                <p className="text-xs text-muted-foreground">Calculating ETA…</p>
              ) : eta ? (
                <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-xs">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  <span className="font-medium text-sky-100">
                    {eta.formattedDuration}
                  </span>
                  <span className="text-sky-300/70">·</span>
                  <span className="text-sky-200/80">{eta.formattedDistance}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">ETA unavailable for this address.</p>
              )}
              <RouteMap address={address} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No address provided.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
