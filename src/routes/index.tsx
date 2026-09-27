import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Motorcycle Doctors — Workshop Calendar" },
      { name: "description", content: "View the Motorcycle Doctors workshop calendar and manage motorcycle book-ins." },
      { property: "og:title", content: "Motorcycle Doctors — Workshop Calendar" },
      { property: "og:description", content: "View the Motorcycle Doctors workshop calendar and manage motorcycle book-ins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/calendar" });
  },
});
