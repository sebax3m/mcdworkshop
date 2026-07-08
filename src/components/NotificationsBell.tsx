import { useEffect, useMemo, useState } from "react";
import { Bell, Check, CheckCheck, Inbox } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const notifsQ = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as Notification[];
    },
  });

  const readsQ = useQuery({
    queryKey: ["notification-reads", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", user!.id);
      return new Set((data ?? []).map((r: any) => r.notification_id as string));
    },
  });

  const notifs = notifsQ.data ?? [];
  const readSet = readsQ.data ?? new Set<string>();
  const unread = useMemo(() => notifs.filter((n) => !readSet.has(n.id)), [notifs, readSet]);
  const unreadCount = unread.length;

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  async function markRead(id: string) {
    if (!user || readSet.has(id)) return;
    await supabase.from("notification_reads").insert({ notification_id: id, user_id: user.id });
    qc.invalidateQueries({ queryKey: ["notification-reads", user.id] });
  }

  async function markAllRead() {
    if (!user || unread.length === 0) return;
    const rows = unread.map((n) => ({ notification_id: n.id, user_id: user.id }));
    await supabase.from("notification_reads").insert(rows);
    qc.invalidateQueries({ queryKey: ["notification-reads", user.id] });
  }

  function onOpenNotif(n: Notification) {
    markRead(n.id);
    if (n.link) {
      setOpen(false);
      nav({ to: n.link as any });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center shadow-[0_0_10px_-2px_hsl(var(--primary))]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0 overflow-hidden rounded-xl border-border bg-popover shadow-2xl"
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60 bg-muted/40">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">Notifications</div>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {notifsQ.isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : notifs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
              No notifications yet
            </div>
          ) : (
            notifs.map((n) => {
              const isRead = readSet.has(n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => onOpenNotif(n)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-primary/5 transition-colors flex gap-3 items-start",
                    !isRead && "bg-primary/[0.04]",
                  )}
                >
                  <div className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", isRead ? "bg-transparent" : "bg-primary shadow-[0_0_6px_hsl(var(--primary))]")} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm truncate", isRead ? "font-medium text-muted-foreground" : "font-bold text-foreground")}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                    )}
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1 flex items-center gap-2">
                      <span>{n.kind.replace(/_/g, " ")}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  {!isRead && (
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead(n.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
