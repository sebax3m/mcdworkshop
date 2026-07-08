
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  body text,
  link text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "auth read notifications" on public.notifications for select to authenticated using (true);
create policy "auth insert notifications" on public.notifications for insert to authenticated with check (auth.uid() = created_by);
create policy "admins delete notifications" on public.notifications for delete to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role));

create table public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
grant select, insert, delete on public.notification_reads to authenticated;
grant all on public.notification_reads to service_role;
alter table public.notification_reads enable row level security;
create policy "read own reads" on public.notification_reads for select to authenticated using (user_id = auth.uid());
create policy "insert own reads" on public.notification_reads for insert to authenticated with check (user_id = auth.uid());
create policy "delete own reads" on public.notification_reads for delete to authenticated using (user_id = auth.uid());

create index notifications_created_at_idx on public.notifications(created_at desc);
create index notification_reads_user_idx on public.notification_reads(user_id);
