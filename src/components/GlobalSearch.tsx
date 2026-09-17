import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, User, Bike, Calendar, Wrench, FileText } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearch } from "@/lib/global-search.functions";
import { cn } from "@/lib/utils";

const typeMeta: Record<
  string,
  { label: string; icon: typeof User; color: string }
> = {
  customer: { label: "Customers", icon: User, color: "text-blue-500" },
  bike: { label: "Bikes", icon: Bike, color: "text-emerald-500" },
  booking: { label: "Book-ins", icon: Calendar, color: "text-amber-500" },
  job: { label: "Jobs", icon: Wrench, color: "text-rose-500" },
  invoice: { label: "Invoices", icon: FileText, color: "text-violet-500" },
};

export function GlobalSearchButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 px-3 h-10 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs font-semibold uppercase tracking-wider",
          className,
        )}
        aria-label="Open search"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
      </button>
      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof globalSearch>>>([]);
  const [loading, setLoading] = useState(false);
  const search = useServerFn(globalSearch);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await search({ data: { query: q } });
        if (!cancelled) setResults(data);
      } catch (e: any) {
        console.error("Global search failed:", e?.message ?? e);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof results> = {};
    for (const r of results) {
      groups[r.type] = groups[r.type] || [];
      groups[r.type].push(r);
    }
    console.log("[GlobalSearch] results", results.length, "groups", Object.keys(groups), groups);
    return groups;
  }, [results]);

  const handleSelect = (route: string) => {
    onOpenChange(false);
    navigate({ to: route });
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      filter={() => 1}
    >
      <CommandInput
        placeholder="Search customers, bikes, book-ins, jobs, invoices…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length < 2 ? (
          <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
        ) : loading ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : results.length === 0 ? (
          <CommandEmpty>No results found.</CommandEmpty>
        ) : (
          Object.entries(grouped).map(([type, items]) => {
            const meta = typeMeta[type];
            const Icon = meta.icon;
            return (
              <CommandGroup key={type} heading={meta.label}>
                {items.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`${item.type}-${item.id}`}
                    onSelect={() => handleSelect(item.route)}
                    className="cursor-pointer"
                  >
                    <Icon className={cn("mr-2 h-4 w-4 shrink-0", meta.color)} />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium">{item.title}</span>
                      {item.subtitle && (
                        <span className="truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })
        )}
      </CommandList>
    </CommandDialog>
  );
}
