import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileStack,
  Users,
  Package,
  Bike,
  ChevronRight,
  ShieldCheck,
  UserCog,
  Tag,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const sections = [
  {
    to: "/templates",
    icon: FileStack,
    title: "Service Templates",
    desc: "Edit Basic, Annual, Standard, Full and custom service checklists & hours.",
  },
  {
    to: "/settings/booking-types",
    icon: Tag,
    title: "Booking Types",
    desc: "Enable or disable which booking types appear in new booking forms.",
  },
  {
    to: "/customers",
    icon: Users,
    title: "Customers",
    desc: "View, edit and manage customer contact details.",
  },
  {
    to: "/inventory",
    icon: Package,
    title: "Inventory",
    desc: "Manage oils, filters, brake fluid, coolant and parts stock.",
  },
  {
    to: "/motorcycles",
    icon: Bike,
    title: "Bikes",
    desc: "Edit motorcycle details, owners, mileage and service history.",
  },
  {
    to: "/insurance",
    icon: ShieldCheck,
    title: "Insurance Claims",
    desc: "Track collision repair claims, quotes, insurer approvals and parts.",
  },
  {
    to: "/users",
    icon: UserCog,
    title: "Users & Logins",
    desc: "View sign-in history per user, emails, roles and switch the active user.",
  },
] as const;

function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header>
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Workshop</div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage everything that powers your workshop in one place.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to}
              to={s.to}
              className="card-surface group flex items-start gap-4 p-5 hover:border-primary/50 transition-colors"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-bold flex items-center gap-2">
                  {s.title}
                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
