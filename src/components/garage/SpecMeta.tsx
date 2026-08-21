import { GARAGE_SOURCES, GARAGE_VERIFICATIONS, sourceLabel, verification } from "@/lib/garage-library";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck } from "lucide-react";

export function VerificationBadge({ value }: { value: string | null | undefined }) {
  const v = verification(value);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-wider ${v.tone}`}
    >
      <ShieldCheck className="h-3 w-3" />
      {v.label}
    </span>
  );
}

export function SpecMeta({
  source,
  verificationValue,
  updatedAt,
  updatedByName,
}: {
  source: string | null | undefined;
  verificationValue: string | null | undefined;
  updatedAt?: string | null;
  updatedByName?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[0.65rem] text-muted-foreground font-mono">
      <VerificationBadge value={verificationValue} />
      <span>Source: {sourceLabel(source)}</span>
      {updatedByName ? <span>· {updatedByName}</span> : null}
      {updatedAt ? <span>· {new Date(updatedAt).toLocaleDateString("en-GB")}</span> : null}
    </div>
  );
}

export function SourceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Source" />
      </SelectTrigger>
      <SelectContent>
        {GARAGE_SOURCES.map((s) => (
          <SelectItem key={s.value} value={s.value} className="text-xs">
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function VerificationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Verification" />
      </SelectTrigger>
      <SelectContent>
        {GARAGE_VERIFICATIONS.map((s) => (
          <SelectItem key={s.value} value={s.value} className="text-xs">
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
