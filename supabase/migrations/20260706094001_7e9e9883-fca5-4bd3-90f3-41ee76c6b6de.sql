
ALTER TABLE public.invoices DISABLE TRIGGER USER;
DELETE FROM public.insurance_claim_events;
DELETE FROM public.insurance_claims;
DELETE FROM public.dyno_results;
DELETE FROM public.job_photos;
DELETE FROM public.job_notes;
DELETE FROM public.job_tasks;
DELETE FROM public.time_entries;
DELETE FROM public.clock_events;
DELETE FROM public.invoices;
DELETE FROM public.bookings;
DELETE FROM public.jobs;
DELETE FROM public.motorcycles;
DELETE FROM public.customers;
ALTER TABLE public.invoices ENABLE TRIGGER USER;
