/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Search, Bike as BikeIcon, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { SUPPLIERS } from "@/lib/parts-orders";
import { hasPhone } from "@/lib/data-quality";
import { fullBike, initials } from "@/lib/format";
import { fetchAllRows } from "@/lib/fetch-all";
import { displayCustomerName } from "@/lib/display";
import { uploadPhoto } from "@/lib/photos";
import { useBookingTypes } from "@/hooks/useBookingTypes";
import { TimeSlotFields } from "@/components/booking/TimeSlotFields";
import { AddressAutocomplete, AddressMap } from "@/components/booking/AddressAutocomplete";
import { syncBookingCalendarEvent } from "@/lib/google-calendar.functions";

import {
  addMinutesToTime,
  findBookingConflicts,
  formatConflictMessage,
  validateTimeRange,
} from "@/lib/booking-conflicts";
import { refreshContacts } from "@/lib/contacts-cache";
import { lookupRego } from "@/lib/rego-lookup.functions";
import { findLocalBikeByRego, localBikeMissingFields } from "@/lib/rego-local-lookup";

const searchSchema = z.object({
  date: z.string().optional(),
  time: z.string().optional(),
  rego: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().optional(),
  mileage: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_authenticated/bookings/new")({
  validateSearch: (search) => searchSchema.parse(search),
  component: NewBooking,
});

// Fallback if the booking_types table is temporarily unreachable; the
// active list is fetched from the DB by useBookingTypes().
const FALLBACK_SERVICE_TYPES = ["Standard Service", "Other"];

function NewBooking() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string>("Standard Service");
  const [serviceTypeOther, setServiceTypeOther] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [scheduledDate, setScheduledDate] = useState<string>(search.date || today);
  const [dropTime, setDropTime] = useState<string>(search.time || "09:00");
  const [endTime, setEndTime] = useState<string>(addMinutesToTime(search.time || "09:00", 60));
  const [estHours, setEstHours] = useState<string>("2");
  const [conflictError, setConflictError] = useState<string | null>(null);
  const bookingTypesQuery = useBookingTypes(true);
  const activeServiceTypes = (bookingTypesQuery.data ?? []).map((t) => t.name);
  const serviceTypeOptions =
    activeServiceTypes.length > 0 ? activeServiceTypes : FALLBACK_SERVICE_TYPES;
  const [mileage, setMileage] = useState<string>("");
  const [wof, setWof] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [partsRequired, setPartsRequired] = useState(false);
  const [partRows, setPartRows] = useState<
    { description: string; part_number: string; qty: string; supplier: string; notes: string }[]
  >([]);
  const [loanBike, setLoanBike] = useState<boolean>(false);
  const [loanBikeId, setLoanBikeId] = useState<string | null>(null);
  const [loanBikeReturn, setLoanBikeReturn] = useState<string>("");
  const [loanBikeStartKm, setLoanBikeStartKm] = useState<string>("");
  const [pickupRequired, setPickupRequired] = useState<boolean>(false);
  const [deliveryRequired, setDeliveryRequired] = useState<boolean>(false);
  const [transportAddress, setTransportAddress] = useState<string>("");
  const [transportNotes, setTransportNotes] = useState<string>("");
  const [techId, setTechId] = useState<string | null>(null);
  const [gInvite, setGInvite] = useState<boolean>(false);
  const [gEmail, setGEmail] = useState<string>("");
  const [gIncludeEnd, setGIncludeEnd] = useState<boolean>(false);
  const [arrivalPhotos, setArrivalPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search$, setSearch$] = useState("");
  const [searchMode, setSearchMode] = useState<"name" | "rego" | "mobile">("name");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [ncFirst, setNcFirst] = useState("");
  const [ncLast, setNcLast] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [showNewBike, setShowNewBike] = useState(false);
  const [nbMake, setNbMake] = useState("");
  const [nbModel, setNbModel] = useState("");
  const [nbYear, setNbYear] = useState("");
  const [nbRego, setNbRego] = useState("");
  const [nbNoRego, setNbNoRego] = useState(false);
  const [nbLookingUp, setNbLookingUp] = useState(false);

  async function fetchBikeFromRego() {
    const plate = nbRego.trim();
    if (!plate) return toast.error("Enter a rego first");
    setNbLookingUp(true);
    try {
      // 1) Check the workshop's own records first — saves a Carjam lookup.
      const local = await findLocalBikeByRego(plate);
      if (local) {
        const missing = localBikeMissingFields(local);
        if (local.make) setNbMake(local.make);
        if (local.model) setNbModel(local.model);
        if (local.year) setNbYear(String(local.year));
        if (local.color) setNbColor(local.color);
        if (local.vin) setNbVin(local.vin);
        if (local.wof_expiry) setNbWofExpiry(local.wof_expiry);
        if (local.rego_expiry) setNbRegoExpiry(local.rego_expiry);
        if (missing.length === 0) {
          setNbFetched(true);
          toast.success(
            `Loaded from workshop records: ${[local.year, local.make, local.model].filter(Boolean).join(" ")}`,
          );
          return;
        }
        const wantsUpdate = window.confirm(
          `This bike is already in the workshop records, but missing: ${missing.join(", ")}.\n\nUpdate from CarJam now?`,
        );
        if (!wantsUpdate) {
          setNbFetched(true);
          toast.success("Loaded from workshop records (not updated from CarJam)");
          return;
        }
      }
      // 2) Fall back to Carjam.
      const r = await lookupRego({ data: { rego: plate } });
      if (r.make) setNbMake(r.make);
      if (r.model) setNbModel(r.model);
      if (r.year) setNbYear(String(r.year));
      if (r.color) setNbColor(r.color);
      if (r.vin) setNbVin(r.vin);
      if (r.wof_expiry) setNbWofExpiry(r.wof_expiry);
      if (r.rego_expiry) setNbRegoExpiry(r.rego_expiry);
      setNbFetched(true);
      // Persist to the bike's record right away, even if the booking is never finished.
      if (local) {
        saveCarjamDataToBike(local.id, r, local)
          .then(() => toast.success("Bike record updated with CarJam data"))
          .catch(() => {});
      }
      toast.success(`Found ${[r.year, r.make, r.model].filter(Boolean).join(" ") || plate}`);
    } catch (e: any) {
      toast.error(e?.message || "Rego lookup failed");
    } finally {
      setNbLookingUp(false);
    }
  }
  const [nbColor, setNbColor] = useState("");
  const [nbVin, setNbVin] = useState("");
  const [nbWofExpiry, setNbWofExpiry] = useState("");
  const [nbRegoExpiry, setNbRegoExpiry] = useState("");
  const [nbFetched, setNbFetched] = useState(false);
  const [creatingBike, setCreatingBike] = useState(false);

  const customers = useQuery({
    queryKey: ["bk-customers"],
    refetchOnWindowFocus: true,
    queryFn: async () =>
      await fetchAllRows((from, to) =>
        (supabase as any)
          .from("customers")
          .select("*")
          .or("is_archived.is.null,is_archived.eq.false")
          .order("first_name")
          .range(from, to),
      ),
  });
  const bikes = useQuery({
    queryKey: ["bk-bikes", customerId],
    enabled: !!customerId,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("motorcycles")
          .select("*")
          .eq("customer_id", customerId!)
          .eq("is_archived", false)
      ).data ?? [],
  });
  const allBikes = useQuery({
    queryKey: ["bk-all-bikes"],
    refetchOnWindowFocus: true,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("motorcycles")
          .select("id, customer_id, rego, year, make, model")
          .eq("is_archived", false)
          .range(0, 49999)
      ).data ?? [],
  });
  const techs = useQuery({
    queryKey: ["bk-techs"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id");
      const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
      if (!ids.length) return [];
      return (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? [];
    },
  });
  const loanBikesQ = useQuery({
    queryKey: ["bk-loan-bikes"],
    queryFn: async () =>
      (
        await supabase
          .from("loan_bikes")
          .select("id, name, current_km, active")
          .eq("active", true)
          .order("name")
      ).data ?? [],
  });
  const activeLoansQ = useQuery({
    queryKey: ["bk-active-loans"],
    queryFn: async () =>
      (
        await supabase
          .from("bookings")
          .select("loan_bike_id, loan_bike_expected_return, customers(first_name,last_name)")
          .not("loan_bike_id", "is", null)
          .is("loan_bike_returned_at", null)
      ).data ?? [],
  });

  const customer = (customers.data as any[] | undefined)?.find((c) => c.id === customerId);
  const bike = (bikes.data as any[] | undefined)?.find((b) => b.id === bikeId);
  const searchResults = useMemo(() => {
    const s = search$.trim().toLowerCase();
    const allC: any[] = customers.data ?? [];
    const allB: any[] = allBikes.data ?? [];
    if (!s) return allC.slice(0, 20).map((c) => ({ customer: c, bike: null as any }));
    if (searchMode === "rego") {
      const matches = allB.filter((b) => (b.rego ?? "").toLowerCase().includes(s));
      return matches
        .map((b) => ({ customer: allC.find((c) => c.id === b.customer_id), bike: b }))
        .filter((r) => r.customer)
        .slice(0, 20);
    }
    if (searchMode === "mobile") {
      return allC
        .filter((c) =>
          (c.phone ?? "").toLowerCase().replace(/\s/g, "").includes(s.replace(/\s/g, "")),
        )
        .slice(0, 20)
        .map((c) => ({ customer: c, bike: null }));
    }
    return allC
      .filter((c) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase().includes(s))
      .slice(0, 20)
      .map((c) => ({ customer: c, bike: null }));
  }, [customers.data, allBikes.data, search$, searchMode]);

  async function createCustomer() {
    if (!ncFirst.trim()) return toast.error("First name required");
    if (!hasPhone(ncPhone)) return toast.error("A valid phone number is required");
    setCreatingCustomer(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          first_name: ncFirst.trim(),
          last_name: ncLast.trim() || null,
          phone: ncPhone.trim() || null,
          email: ncEmail.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (partsRequired) {
        const rows = partRows
          .filter((r) => r.description.trim())
          .map((r, i) => ({
            booking_id: data.id,
            description: r.description.trim(),
            part_number: r.part_number.trim() || null,
            qty_required: Number(r.qty) || 1,
            supplier: r.supplier || null,
            notes: r.notes.trim() || null,
            sort_order: i,
          }));
        if (rows.length) {
          const { error: pe } = await supabase.from("booking_parts").insert(rows);
          if (pe) toast.error(`Parts not saved: ${pe.message}`);
        }
      }
      await refreshContacts(qc);
      setCustomerId(data.id);
      setShowNewCustomer(false);
      setNcFirst("");
      setNcLast("");
      setNcPhone("");
      setNcEmail("");
      setShowNewBike(true);
      toast.success("Customer created — now add their motorcycle");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function createBike() {
    if (!customerId) return toast.error("Pick a customer first");
    if (!nbMake.trim() || !nbModel.trim()) return toast.error("Make and model required");
    setCreatingBike(true);
    try {
      const { data, error } = await (supabase as any)
        .from("motorcycles")
        .insert({
          customer_id: customerId,
          make: nbMake.trim(),
          model: nbModel.trim(),
          year: nbYear ? Number(nbYear) : null,
          rego: nbRego.trim().toUpperCase() || null,
          color: nbColor.trim() || null,
          vin: nbVin.trim().toUpperCase() || null,
          wof_expiry: nbWofExpiry || null,
          rego_expiry: nbRegoExpiry || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await refreshContacts(qc);
      setBikeId(data.id);
      setNbMake("");
      setNbModel("");
      setNbYear("");
      setNbRego("");
      setNbNoRego(false);
      setNbColor("");
      setNbVin("");
      setNbWofExpiry("");
      setNbRegoExpiry("");
      setNbFetched(false);
      setShowNewBike(false);
      toast.success("Motorcycle added");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add motorcycle");
    } finally {
      setCreatingBike(false);
    }
  }

  async function handlePhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const f of Array.from(files).slice(0, 8)) {
        const path = await uploadPhoto(f, "arrival");
        uploaded.push(path);
      }
      setArrivalPhotos((p) => [...p, ...uploaded]);
      toast.success(`${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded`);
    } catch (err: any) {
      toast.error(err.message ?? "Photo upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save(openJobCard = false) {
    if (!customer) return toast.error("Pick a customer");
    if (!bike) return toast.error("Pick a motorcycle");
    if (!scheduledDate) return toast.error("Pick a date");
    const timeErr = validateTimeRange(dropTime, endTime);
    if (timeErr) {
      setConflictError(timeErr);
      return toast.error(timeErr);
    }
    setSaving(true);
    setConflictError(null);
    try {
      // Server-side global-capacity conflict check
      const conflicts = await findBookingConflicts({
        date: scheduledDate,
        startTime: dropTime,
        endTime: endTime,
      });
      if (conflicts.length > 0) {
        const msg = formatConflictMessage(conflicts);
        setConflictError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          customer_id: customer.id,
          motorcycle_id: bike.id,
          assigned_tech_id: techId,
          service_type: serviceType,
          service_type_other: serviceType === "Other" ? serviceTypeOther.trim() || null : null,
          priority,
          scheduled_date: scheduledDate,
          drop_off_time: dropTime || null,
          scheduled_end_time: endTime || null,
          estimated_hours: Number(estHours) || 1,
          mileage: mileage ? parseInt(mileage) : null,
          wof_expiry: wof || null,
          rego: bike.rego ?? null,
          vin: bike.vin ?? null,
          instructions,
          parts_required: partsRequired,
          arrival_photos: arrivalPhotos,
          loan_bike: loanBike,
          loan_bike_id: loanBike ? loanBikeId : null,
          loan_bike_expected_return: loanBike && loanBikeReturn ? loanBikeReturn : null,
          loan_bike_start_km: loanBike && loanBikeStartKm ? parseInt(loanBikeStartKm) : null,
          pickup_required: pickupRequired,
          delivery_required: deliveryRequired,
          transport_address:
            pickupRequired || deliveryRequired ? transportAddress.trim() || null : null,
          transport_notes:
            pickupRequired || deliveryRequired ? transportNotes.trim() || null : null,
          status: openJobCard ? "checked_in" : "booked",
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      if (mileage)
        await supabase
          .from("motorcycles")
          .update({ mileage: parseInt(mileage) })
          .eq("id", bike.id);

      if (gInvite) {
        const inviteEmail = (gEmail || customer.email || "").trim();
        if (!inviteEmail) {
          toast.error("No email address for the Google Calendar invitation");
        } else {
          try {
            const result = await syncBookingCalendarEvent({
              data: { bookingId: data.id, email: inviteEmail, includeEnd: gIncludeEnd },
            });
            if (result.ok) {
              toast.success(`Google Calendar invitation sent to ${inviteEmail}`);
            } else {
              toast.error(result.message);
            }
          } catch (e: any) {
            toast.error(e?.message ?? "Booking saved, but the Google invitation failed");
          }
        }
      }



      if (openJobCard) {
        const { data: tmpl } = await supabase
          .from("service_templates")
          .select("*")
          .ilike("name", `%${serviceType.split(" ")[0]}%`)
          .limit(1)
          .maybeSingle();
        const { data: job, error: jerr } = await supabase
          .from("jobs")
          .insert({
            customer_id: customer.id,
            motorcycle_id: bike.id,
            template_id: (tmpl as any)?.id ?? null,
            technician_id: techId,
            assigned_tech_id: techId,
            title: serviceType,
            description: (tmpl as any)?.description ?? null,
            complaint: instructions || null,
            estimated_hours: Number(estHours) || 1,
            status: techId ? "assigned" : "new",
            scheduled_at: scheduledDate,
            odometer: mileage ? parseInt(mileage) : null,
          })
          .select("id")
          .single();
        if (jerr) throw jerr;
        if ((tmpl as any)?.tasks) {
          const tasks = ((tmpl as any).tasks as any[]).map((t: any, i: number) => ({
            job_id: job.id,
            label: t.label,
            sort_order: i,
          }));
          if (tasks.length) await supabase.from("job_tasks").insert(tasks);
        }
        await supabase.from("bookings").update({ job_id: job.id }).eq("id", data.id);
        toast.success("Booking + job card created");
        nav({ to: "/jobs/$jobId", params: { jobId: job.id } });
        return;
      }

      toast.success("Booking created");
      nav({ to: "/calendar" });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create booking");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 max-w-3xl mx-auto"
    >
      <header className="flex items-center gap-3">
        <Link
          to="/calendar"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary/50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Reception</div>
          <h1 className="font-display text-2xl font-bold">New Booking</h1>
        </div>
      </header>

      {/* CUSTOMER */}
      <section className="card-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Customer</Label>
          {customer && (
            <button
              onClick={() => {
                setCustomerId(null);
                setBikeId(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Change
            </button>
          )}
        </div>
        {customer ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
            <span className="grid h-10 w-10 place-items-center rounded-full gold-surface font-semibold text-sm">
              {initials(displayCustomerName(customer, ""))}
            </span>
            <div className="min-w-0">
              <div className="font-semibold truncate">{displayCustomerName(customer, "")}</div>
              <div className="text-xs text-muted-foreground truncate">
                {customer.phone || customer.email || "—"}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search$}
                  onChange={(e) => setSearch$(e.target.value)}
                  placeholder={
                    searchMode === "name"
                      ? "Search by name…"
                      : searchMode === "rego"
                        ? "Search by rego (plate)…"
                        : "Search by mobile number…"
                  }
                  className="w-full rounded-xl bg-input border border-border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
              <button
                onClick={() => setShowNewCustomer((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold hover:border-primary/50"
              >
                <Plus className="h-3.5 w-3.5" /> New
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mr-1">
                Search by:
              </span>
              {(["name", "rego", "mobile"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSearchMode(m)}
                  className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold border transition-colors ${
                    searchMode === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {m === "name" ? "Name" : m === "rego" ? "Rego" : "Mobile"}
                </button>
              ))}
            </div>

            {showNewCustomer && (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
                <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  Add new customer
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="First name"
                    value={ncFirst}
                    onChange={(e) => setNcFirst(e.target.value)}
                  />
                  <Input
                    placeholder="Last name (optional)"
                    value={ncLast}
                    onChange={(e) => setNcLast(e.target.value)}
                  />
                  <Input
                    placeholder="Phone"
                    value={ncPhone}
                    onChange={(e) => setNcPhone(e.target.value)}
                  />
                  <Input
                    placeholder="Email (optional)"
                    type="email"
                    value={ncEmail}
                    onChange={(e) => setNcEmail(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowNewCustomer(false)}
                    className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <Button
                    onClick={createCustomer}
                    disabled={creatingCustomer}
                    size="sm"
                    className="gold-surface font-bold"
                  >
                    {creatingCustomer ? "Saving…" : "Add Customer"}
                  </Button>
                </div>
              </div>
            )}

            <div className="max-h-52 overflow-y-auto space-y-1.5">
              {searchResults.map(({ customer: c, bike: b }: any) => (
                <button
                  key={`${c.id}-${b?.id ?? "none"}`}
                  onClick={() => {
                    setCustomerId(c.id);
                    if (b?.id) setBikeId(b.id);
                  }}
                  className="w-full text-left flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-semibold">
                    {initials(`${c.first_name} ${c.last_name ?? ""}`)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">
                      {c.first_name} {c.last_name ?? ""}
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {b
                        ? `${b.rego ?? "—"} · ${[b.year, b.make, b.model].filter(Boolean).join(" ")}`
                        : c.phone || c.email || "—"}
                    </span>
                  </span>
                </button>
              ))}
              {searchResults.length === 0 && (
                <button
                  onClick={() => setShowNewCustomer(true)}
                  className="block w-full text-center text-sm text-primary py-3"
                >
                  + Add new customer
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* BIKE */}
      {customer && (
        <section className="card-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Motorcycle
            </Label>
            {bike ? (
              <button
                onClick={() => setBikeId(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Change
              </button>
            ) : (
              <button
                onClick={() => setShowNewBike((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-primary font-semibold"
              >
                <Plus className="h-3 w-3" /> New bike
              </button>
            )}
          </div>
          {bike ? (
            <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-background">
                <BikeIcon className="h-5 w-5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{fullBike(bike)}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {bike.rego ?? "no rego"}
                  {bike.vin ? ` · VIN ${bike.vin.slice(-6)}` : ""}
                </div>
              </div>
            </div>
          ) : (
            <>
              {showNewBike && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
                  <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                    Add motorcycle for {customer.first_name}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Make"
                      value={nbMake}
                      onChange={(e) => setNbMake(e.target.value)}
                    />
                    <Input
                      placeholder="Model"
                      value={nbModel}
                      onChange={(e) => setNbModel(e.target.value)}
                    />
                    <Input
                      placeholder="Year"
                      inputMode="numeric"
                      value={nbYear}
                      onChange={(e) => setNbYear(e.target.value)}
                    />
                    <div className="flex gap-1.5">
                      <Input
                        placeholder={nbNoRego ? "No rego" : "Rego (plate)"}
                        value={nbNoRego ? "" : nbRego}
                        onChange={(e) => {
                          setNbRego(e.target.value);
                          if (e.target.value.trim()) setNbNoRego(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            fetchBikeFromRego();
                          }
                        }}
                        disabled={nbNoRego}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-2.5 text-xs shrink-0"
                        disabled={nbNoRego || nbLookingUp || !nbRego.trim()}
                        onClick={fetchBikeFromRego}
                        title="Look up make, model and year from the rego"
                      >
                        <Search className="h-3.5 w-3.5" />
                        {nbLookingUp ? "…" : "Fetch"}
                      </Button>
                    </div>
                    <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={nbNoRego}
                        onChange={(e) => {
                          setNbNoRego(e.target.checked);
                          if (e.target.checked) setNbRego("");
                        }}
                      />
                      Motorcycle has no rego plate
                    </label>
                    <Input
                      placeholder="Colour (optional)"
                      value={nbColor}
                      onChange={(e) => setNbColor(e.target.value)}
                      className="col-span-2"
                    />
                  </div>
                  {(nbFetched || nbVin || nbWofExpiry || nbRegoExpiry) && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <div className="text-[0.625rem] uppercase tracking-wider text-primary font-bold">
                        Vehicle details {nbFetched ? "(from Carjam)" : ""}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                            WOF expiry
                          </Label>
                          <Input
                            type="date"
                            value={nbWofExpiry}
                            onChange={(e) => setNbWofExpiry(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                            Rego expiry
                          </Label>
                          <Input
                            type="date"
                            value={nbRegoExpiry}
                            onChange={(e) => setNbRegoExpiry(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                            VIN
                          </Label>
                          <Input
                            value={nbVin}
                            onChange={(e) => setNbVin(e.target.value.toUpperCase())}
                            placeholder="VIN / chassis"
                            className="mt-1 uppercase tracking-wider"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowNewBike(false)}
                      className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <Button
                      onClick={createBike}
                      disabled={creatingBike}
                      size="sm"
                      className="gold-surface font-bold"
                    >
                      {creatingBike ? "Saving…" : "Add Motorcycle"}
                    </Button>
                  </div>
                </div>
              )}
              {bikes.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading bikes…</div>
              ) : (bikes.data ?? []).length === 0 ? (
                !showNewBike && (
                  <button
                    onClick={() => setShowNewBike(true)}
                    className="block w-full text-center text-sm text-primary py-3"
                  >
                    + Add motorcycle for this customer
                  </button>
                )
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {(bikes.data ?? []).map((b: any) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setBikeId(b.id);
                        if (b.mileage) setMileage(String(b.mileage));
                        if (b.wof_expiry) setWof(b.wof_expiry);
                      }}
                      className="text-left rounded-xl border border-border p-3 hover:border-primary/50 transition-colors"
                    >
                      <div className="font-semibold text-sm truncate">{fullBike(b)}</div>
                      <div className="text-xs text-muted-foreground truncate">{b.rego || "—"}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* SERVICE */}
      {bike && (
        <>
          <section className="card-surface p-4 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Service type
            </Label>
            <div className="flex flex-wrap gap-2">
              {serviceTypeOptions.map((s: string) => (
                <button
                  key={s}
                  onClick={() => setServiceType(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    serviceType === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {serviceType === "Other" && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Other service details
                </Label>
                <Textarea
                  value={serviceTypeOther}
                  onChange={(e) => setServiceTypeOther(e.target.value)}
                  placeholder="Describe the service..."
                  className="min-h-[64px]"
                />
              </div>
            )}
          </section>

          <section className="card-surface p-4 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Priority
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: "High",
                  value: "high",
                  color: "border-red-500 bg-red-500/10 text-red-400",
                },
                {
                  label: "Normal",
                  value: "normal",
                  color: "border-primary bg-primary/10 text-primary",
                },
                {
                  label: "Low",
                  value: "low",
                  color: "border-blue-500 bg-blue-500/10 text-blue-400",
                },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    priority === p.value
                      ? p.color
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <section className="card-surface p-4 space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                Calendar slot
              </Label>
              <TimeSlotFields
                startTime={dropTime}
                endTime={endTime}
                onStartChange={(v) => {
                  setDropTime(v);
                  setConflictError(null);
                }}
                onEndChange={(v) => {
                  setEndTime(v);
                  setConflictError(null);
                }}
                externalError={conflictError}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Estimated job hours
                </Label>
                <Input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={estHours}
                  onChange={(e) => setEstHours(e.target.value)}
                  className="mt-1.5"
                />
                <div className="text-[0.6875rem] text-muted-foreground mt-1">
                  Informational — does not change the calendar slot.
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Mileage (km)
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  WOF expiry
                </Label>
                <Input
                  type="date"
                  value={wof}
                  onChange={(e) => setWof(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          </section>

          <section className="card-surface p-4 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Assign technician
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setTechId(null)}
                className={`rounded-xl border p-3 text-left text-sm ${techId === null ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <div className="font-semibold">Unassigned</div>
              </button>
              {(techs.data ?? []).map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setTechId(t.id)}
                  className={`rounded-xl border p-3 text-left flex items-center gap-2 ${techId === t.id ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[0.625rem] font-semibold">
                    {initials(t.full_name || "?")}
                  </span>
                  <span className="text-sm font-semibold truncate">{t.full_name || "Unnamed"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card-surface p-4 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Instructions
            </Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step-by-step instructions for the technician — shown on the Job Card"
              rows={3}
            />
            <div className="rounded-xl border border-border p-3 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Bike transport
              </div>
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-primary"
                  checked={pickupRequired}
                  onChange={(e) => setPickupRequired(e.target.checked)}
                />
                <span className="font-semibold">🚚 We pick up the bike from the customer</span>
              </label>
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-primary"
                  checked={deliveryRequired}
                  onChange={(e) => setDeliveryRequired(e.target.checked)}
                />
                <span className="font-semibold">🏁 We drop the bike back after the work</span>
              </label>
              {(pickupRequired || deliveryRequired) && (
                <div className="space-y-2 pt-1">
                  <AddressAutocomplete
                    value={transportAddress}
                    onChange={setTransportAddress}
                  />
                  <AddressMap address={transportAddress} />
                  <Textarea
                    value={transportNotes}
                    onChange={(e) => setTransportNotes(e.target.value)}
                    placeholder="Transport notes (contact, access, preferred time…)"
                    rows={2}
                  />
                </div>
              )}

            </div>

            <div className="rounded-xl border border-border p-3 space-y-3">
              <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Google Calendar invitation
              </div>
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-primary"
                  checked={gInvite}
                  onChange={(e) => {
                    setGInvite(e.target.checked);
                    if (e.target.checked && !gEmail) setGEmail(customer?.email ?? "");
                  }}
                />
                <span className="font-semibold">📅 Send Google Calendar invitation to customer</span>
              </label>
              {gInvite && (
                <div className="space-y-2 pt-1">
                  {customer?.email ? (
                    <p className="text-xs text-muted-foreground">
                      Invitation will be sent to{" "}
                      <span className="font-semibold text-foreground">
                        {gEmail || customer.email}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This customer has no email saved — enter one for the invitation.
                    </p>
                  )}
                  <Input
                    type="email"
                    value={gEmail}
                    onChange={(e) => setGEmail(e.target.value)}
                    placeholder="customer@email.com"
                  />
                  <label className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-primary"
                      checked={gIncludeEnd}
                      onChange={(e) => setGIncludeEnd(e.target.checked)}
                    />
                    <span>Include expected completion / pick-up time</span>
                  </label>
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer hover:border-primary/50">
              <input
                type="checkbox"
                className="h-5 w-5 accent-amber-500"
                checked={loanBike}
                onChange={(e) => setLoanBike(e.target.checked)}
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold">🏍️ Customer needs a loan bike</span>
                <span className="block text-xs text-muted-foreground">
                  Highlighted on the calendar so the workshop can arrange one
                </span>
              </span>
            </label>

            <div className="rounded-xl border border-orange-500/40 p-3 space-y-2">
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-orange-500"
                  checked={partsRequired}
                  onChange={(e) => {
                    setPartsRequired(e.target.checked);
                    if (e.target.checked && partRows.length === 0)
                      setPartRows([{ description: "", part_number: "", qty: "1", supplier: "", notes: "" }]);
                  }}
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">📦 Order parts</span>
                  <span className="block text-xs text-muted-foreground">
                    Flags the book-in as PARTS REQUIRED and adds it to Parts Orders
                  </span>
                </span>
              </label>
              {partsRequired && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Optional — leave blank if you don't know the exact parts yet.
                  </p>
                  {partRows.map((r, i) => {
                    const upd = (k: string, v: string) =>
                      setPartRows((rs) => rs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                    return (
                      <div key={i} className="grid grid-cols-12 gap-1.5">
                        <input className="col-span-12 sm:col-span-4 h-9 rounded-md border border-border bg-background px-2 text-sm" placeholder="Part description" value={r.description} onChange={(e) => upd("description", e.target.value)} />
                        <input className="col-span-5 sm:col-span-2 h-9 rounded-md border border-border bg-background px-2 text-sm" placeholder="Part #" value={r.part_number} onChange={(e) => upd("part_number", e.target.value)} />
                        <input type="number" min={1} className="col-span-2 sm:col-span-1 h-9 rounded-md border border-border bg-background px-2 text-sm" value={r.qty} onChange={(e) => upd("qty", e.target.value)} />
                        <select className="col-span-5 sm:col-span-2 h-9 rounded-md border border-border bg-background px-1 text-sm" value={r.supplier} onChange={(e) => upd("supplier", e.target.value)}>
                          <option value="">Supplier</option>
                          {SUPPLIERS.map((s) => <option key={s}>{s}</option>)}
                        </select>
                        <input className="col-span-10 sm:col-span-2 h-9 rounded-md border border-border bg-background px-2 text-sm" placeholder="Notes" value={r.notes} onChange={(e) => upd("notes", e.target.value)} />
                        <button type="button" onClick={() => setPartRows((rs) => rs.filter((_, j) => j !== i))} className="col-span-2 sm:col-span-1 h-9 rounded-md border border-border text-xs hover:border-red-500/60">✕</button>
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => setPartRows((rs) => [...rs, { description: "", part_number: "", qty: "1", supplier: "", notes: "" }])} className="rounded-md border border-border px-3 h-8 text-xs font-semibold hover:border-primary/50">
                    + Add part
                  </button>
                </div>
              )}
            </div>

            {loanBike && (
              <div className="space-y-3 rounded-xl border border-amber-400/40 bg-amber-400/5 p-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Assign loan bike
                  </Label>
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    {(loanBikesQ.data ?? []).map((lb: any) => {
                      const outWith = (activeLoansQ.data ?? []).find(
                        (a: any) => a.loan_bike_id === lb.id,
                      );
                      const busy = !!outWith;
                      return (
                        <button
                          key={lb.id}
                          type="button"
                          onClick={() => setLoanBikeId(loanBikeId === lb.id ? null : lb.id)}
                          className={`rounded-xl border p-3 text-left flex items-center gap-2 ${
                            loanBikeId === lb.id
                              ? "border-amber-400 bg-amber-400/10"
                              : busy
                                ? "border-destructive/40 opacity-70"
                                : "border-border"
                          }`}
                        >
                          <span className="flex-1">
                            <span className="block text-sm font-semibold">{lb.name}</span>
                            <span className="block text-[0.6875rem] text-muted-foreground">
                              {lb.current_km?.toLocaleString?.() ?? 0} km
                              {busy &&
                                outWith?.customers &&
                                ` · Out with ${displayCustomerName(outWith.customers, "")}`}
                              {busy &&
                                outWith?.loan_bike_expected_return &&
                                ` · back ${outWith.loan_bike_expected_return}`}
                            </span>
                          </span>
                          {busy && (
                            <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider">
                              Out
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {(loanBikesQ.data ?? []).length === 0 && (
                      <div className="text-xs text-muted-foreground">
                        No loan bikes registered. Add them from the Loan Bikes menu.
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Expected return
                    </Label>
                    <input
                      type="date"
                      value={loanBikeReturn}
                      onChange={(e) => setLoanBikeReturn(e.target.value)}
                      className="w-full rounded-lg bg-card border border-border px-3 py-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Start km (optional)
                    </Label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={loanBikeStartKm}
                      onChange={(e) => setLoanBikeStartKm(e.target.value)}
                      placeholder="Odometer at handover"
                      className="w-full rounded-lg bg-card border border-border px-3 py-2 text-sm mt-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="card-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Arrival & damage photos
              </Label>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50 cursor-pointer">
                <Camera className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Add"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handlePhotos(e.target.files)}
                />
              </label>
            </div>
            {arrivalPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {arrivalPhotos.map((p) => (
                  <div
                    key={p}
                    className="relative aspect-square rounded-lg overflow-hidden bg-muted"
                  >
                    <PhotoThumb path={p} />
                    <button
                      onClick={() => setArrivalPhotos((arr) => arr.filter((x) => x !== p))}
                      className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-background/80 text-foreground"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid sm:grid-cols-2 gap-3">
            <Button
              onClick={() => save(false)}
              disabled={saving}
              variant="outline"
              className="w-full h-14 text-base font-bold"
            >
              {saving ? "Saving…" : "Create Booking"}
            </Button>
            <Button
              onClick={() => save(true)}
              disabled={saving}
              className="w-full h-14 gold-surface text-base font-bold"
            >
              {saving ? "Saving…" : "Create & Open Job Card"}
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}

function PhotoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useMemo(() => {
    import("@/lib/photos").then(({ getSignedUrl }) => getSignedUrl(path).then(setUrl));
  }, [path]);
  if (!url) return <div className="h-full w-full animate-pulse bg-muted" />;
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}
