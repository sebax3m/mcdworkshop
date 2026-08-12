import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { suggestAddresses, type AddressSuggestion } from "@/lib/maps.functions";

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

/** Embedded Google map for a transport address. */
export function AddressMap({ address }: { address: string }) {
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
    | string
    | undefined;
  const q = address.trim();
  if (!key || q.length < 5) return null;
  return (
    <iframe
      title="Transport location"
      className="h-48 w-full rounded-xl border border-border"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={`https://www.google.com/maps/embed/v1/place?key=${key}&q=${encodeURIComponent(q)}&zoom=14`}
    />
  );
}

export const WORKSHOP_ADDRESS = "94 Wairau Road, Wairau Valley, Auckland, New Zealand";

/** Embedded driving route from the workshop to the given address. */
export function RouteMap({ address }: { address: string }) {
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
    | string
    | undefined;
  const q = address.trim();
  if (!key || q.length < 5) return <AddressMap address={address} />;
  return (
    <iframe
      title="Transport route"
      className="h-48 w-full rounded-xl border border-border"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={`https://www.google.com/maps/embed/v1/directions?key=${key}&origin=${encodeURIComponent(
        WORKSHOP_ADDRESS,
      )}&destination=${encodeURIComponent(q)}&mode=driving`}
    />
  );
}
