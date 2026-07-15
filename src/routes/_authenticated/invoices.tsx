import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/invoices")({
  component: InvoicesLayout,
});

function InvoicesLayout() {
  return <Outlet />;
}
