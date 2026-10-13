import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  Package, 
  Boxes, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FinancialDashboard(props: any) {
  const {
    userEmail,
    logout,
    products,
    clients,
    sales,
    loans,
    purchases,
    loadingData,
    dataError,
    openModal,
    openSaleModal,
    openLoanModal,
    quickOpen,
    setQuickOpen,
    setSection,
    setPrintable,
  } = props;
  const [period, setPeriod] = useState<Period>("Hoy");
  const [showBreakdown, setShowBreakdown] = useState(false);

  const currentDate = new Date().toISOString().split("T")[0];

  const actions = [
    { title: "Registrar venta", icon: ShoppingBag, tone: "bg-action-yellow", type: "venta" as const },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Banner Superior */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sidebar-primary to-sidebar-accent p-6 text-sidebar-primary-foreground shadow-lg sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block rounded-full bg-sidebar-primary-foreground/15 px-3 py-1 text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
            Río Market Express
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-4xl">
            Panel Principal
          </h1>
          <p className="mt-2 text-sm text-sidebar-primary-foreground/80 sm:text-base">
            Control rápido de inventario y registro de ventas del día.
          </p>
        </div>
      </section>

      {/* Acciones rápidas */}
      <section>
        <h2 className="mb-4 text-lg font-bold">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.title}
                variant="ghost"
                onClick={() => openModal(action.type)}
                className={cn(
                  "h-28 flex-col items-start justify-between rounded-2xl p-3",
                  action.tone,
                )}
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-card/80">
                  <Icon />
                </span>
                <span className="text-xs font-bold sm:text-sm">{action.title}</span>
              </Button>
            );
          })}
          <Button
            variant="ghost"
            onClick={() => setSection("inventario")}
            className="h-28 flex-col items-start justify-between rounded-2xl bg-action-mint p-3"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-card/80">
              <Boxes />
            </span>
            <span className="text-xs font-bold sm:text-sm">Inventario</span>
          </Button>
        </div>
      </section>

      {/* Tarjetas de Resumen (Stock y Ventas) */}
      <section className="grid gap-5 sm:grid-cols-2">
        <SummaryCard
          icon={Package}
          label="Unidades en stock"
          value={String(products.reduce((sum, item) => sum + item.stock, 0))}
          onClick={() => setSection("inventario")}
        />
        <SummaryCard
          icon={CreditCard}
          label="Ventas"
          value={String(sales.length)}
          onClick={() => setSection("ventas")}
        />
      </section>
    </div>
  );
}
