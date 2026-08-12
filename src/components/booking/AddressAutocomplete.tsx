import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  suggestAddresses,
  travelFromWorkshop,
  type AddressSuggestion,
  type TravelEta,
} from "@/lib/maps.functions";
import { WORKSHOP_ADDRESS, WORKSHOP_SHORT } from "@/lib/workshop-location";

/** Address input with Auckland-biased Google suggestions. */
export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Pick-up / drop-off address",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const skipRef = useRef(false);

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      suggestAddresses({ data: { query: q } })
        .then((res) => {
          setSuggestions(res);
          setOpen(res.length > 0);
        })
        .catch(() => setSuggestions([]));
    }, 350);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                skipRef.current = true;
                onChange(s.address);
                setOpen(false);
                setSuggestions([]);
              }}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{s.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Embedded Google map for a transport address.
 * Defaults to driving directions from the workshop (94 Wairau Road) so the
 * travel time to the pick-up / drop-off is visible straight away.
 */
export function AddressMap({ address }: { address: string }) {
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
    | string
    | undefined;
  const q = address.trim();
  const [eta, setEta] = useState<TravelEta | null>(null);
  const [etaError, setEtaError] = useState(false);

  useEffect(() => {
    setEta(null);
    setEtaError(false);
    if (q.length < 5) return;
    let cancelled = false;
    travelFromWorkshop({ data: { destination: q } })
      .then((r) => !cancelled && setEta(r))
      .catch(() => !cancelled && setEtaError(true));
    return () => {
      cancelled = true;
    };
  }, [q]);

  if (!key || q.length < 5) return null;
  const src = `https://www.google.com/maps/embed/v1/directions?key=${key}&origin=${encodeURIComponent(
    WORKSHOP_ADDRESS,
  )}&destination=${encodeURIComponent(q)}&mode=driving`;

  return (
    <div className="space-y-1.5">
      <iframe
        title="Route from the workshop"
        className="h-48 w-full rounded-xl border border-border"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={src}
      />
      <div className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
        <Navigation className="h-3 w-3 shrink-0 text-sky-500" />
        <span className="truncate">
          From {WORKSHOP_SHORT}
          {eta ? ` · ${eta.durationText} · ${eta.distanceText}` : etaError ? "" : " · …"}
        </span>
        <a
          href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
            WORKSHOP_ADDRESS,
          )}&destination=${encodeURIComponent(q)}&travelmode=driving`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto shrink-0 font-semibold text-sky-500 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </a>
      </div>
    </div>
  );
}
