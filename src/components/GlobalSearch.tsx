import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, Calendar } from "lucide-react";
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

  const handleSelect = (item: Awaited<ReturnType<typeof globalSearch>>[number]) => {
    onOpenChange(false);
    navigate({
      to: "/calendar",
      search: { highlight: item.id, date: item.date ?? undefined },
    });
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      filter={() => 1}
    >
      <CommandInput
        placeholder="Search book-ins by customer, bike or rego…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length < 2 ? (
          <CommandEmpty>Type at least 2 characters to search book-ins.</CommandEmpty>
        ) : loading ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : results.length === 0 ? (
          <CommandEmpty>No book-ins found.</CommandEmpty>
        ) : (
          <CommandGroup heading="Book-ins (most recent first)">
            {results.map((item) => (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => handleSelect(item)}
                className="cursor-pointer"
              >
                <Calendar className="mr-2 h-4 w-4 shrink-0 text-amber-500" />
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
        )}
      </CommandList>
    </CommandDialog>
  );
}
