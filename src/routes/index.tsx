import { createFileRoute } from "@tanstack/react-router";

import { FinancialDashboard } from "@/components/financial-dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MotoPartesPirueta | Inventario" },
      { name: "description", content: "Panel financiero para gestionar clientes, inventario, ventas a crédito y cobros." },
      { property: "og:title", content: "Sistema de control de inventario y ventas MotoPartesPirueta" },
      { property: "og:description", content: "Controla ventas financiadas, cobros e inventario desde un solo lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancialDashboard,
});
