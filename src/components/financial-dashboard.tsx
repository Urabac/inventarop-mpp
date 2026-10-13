import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Banknote,
  Boxes,
  CalendarDays,
  Calculator,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  CreditCard,
  Home,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  ClipboardList,
  Trash2,
  Settings,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
  X,
  MessageCircle,
  ReceiptText,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AuthGate } from "@/components/auth-gate";
import type {
  Client,
  Frequency,
  Installment,
  Loan,
  Printable,
  Product,
  Sale,
  Purchase,
  SaleLineItem,
} from "@/lib/data-model";
import {
  saveClient,
  saveFinancingEdit,
  saveLoan,
  savePayment,
  saveProduct,
  savePurchase,
  saveSale,
  subscribeAppData,
} from "@/lib/firestore-data";

type Section =
  | "inicio"
  | "inventario"
  | "ventas"
type Modal = "cliente" | "venta" | "prestamo" | "producto" | "compra" | null;
type Period = "Hoy" | "Ayer" | "Últimos 7 días" | "Este mes";

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
// Stable initial date prevents server/client hydration differences; new records use the browser's local date.
const today = "2026-09-19";
const money = (value: number) =>
  value.toLocaleString("es-VE", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const displayDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fullDisplayDate = (date: string) => {
  const formatted = new Date(`${date}T12:00:00`).toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return formatted.charAt(0).toLocaleUpperCase("es") + formatted.slice(1);
};
const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const moveDate = (
  date: string,
  index: number,
  frequency: Frequency,
  skipSaturday = false,
  skipSunday = false,
) => {
  const value = new Date(`${date}T12:00:00`);
  if (frequency === "Mensual") {
    const day = value.getDate();
    value.setMonth(value.getMonth() + index);
    if (value.getDate() < day) value.setDate(0);
  } else {
    const interval = frequency === "Diario" ? 1 : frequency === "Semanal" ? 7 : 15;
    value.setDate(value.getDate() + interval * index);
  }
  while ((skipSaturday && value.getDay() === 6) || (skipSunday && value.getDay() === 0))
    value.setDate(value.getDate() + 1);
  return isoDate(value);
};
const createSchedule = (
  date: string,
  count: number,
  total: number,
  frequency: Frequency,
  skipSaturday = false,
  skipSunday = false,
) => {
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    amount: (baseCents + (index === count - 1 ? remainder : 0)) / 100,
    due: moveDate(date, index + 1, frequency, skipSaturday, skipSunday),
    paid: false,
  }));
};

const installmentPaidAmount = (payment: Installment) =>
  payment.paid ? payment.amount : Math.min(payment.amount, payment.paidAmount ?? 0);
const isInstallmentPaid = (payment: Installment) =>
  payment.paid || installmentPaidAmount(payment) >= payment.amount;
const isInstallmentOverdue = (payment: Installment) =>
  !isInstallmentPaid(payment) && payment.due < localToday();
const isInstallmentPending = (payment: Installment) =>
  !isInstallmentPaid(payment) && payment.due >= localToday();

const rebuildSchedulePreservingPayments = (item: Sale | Loan, count: number, total: number) => {
  const paymentsToKeep = item.installments.filter(
    (payment) => payment.paid || (payment.paidAmount ?? 0) > 0,
  );
  const paidTotal = paymentsToKeep.reduce(
    (sum, payment) => sum + installmentPaidAmount(payment),
    0,
  );
  const pendingCount = count - paymentsToKeep.length;
  const pendingSchedule = pendingCount
    ? createSchedule(
        item.date,
        pendingCount,
        Math.max(0, total - paidTotal),
        item.frequency,
        "skipSaturday" in item && item.skipSaturday,
        "skipSunday" in item && item.skipSunday,
      )
    : [];
  return [
    ...paymentsToKeep.map((payment, index) => ({ ...payment, number: index + 1 })),
    ...pendingSchedule.map((payment, index) => ({
      ...payment,
      number: paymentsToKeep.length + index + 1,
      due: moveDate(
        item.date,
        paymentsToKeep.length + index + 1,
        item.frequency,
        "skipSaturday" in item && item.skipSaturday,
        "skipSunday" in item && item.skipSunday,
      ),
    })),
  ];
};

const navItems = [
  { id: "inicio" as const, label: "Inicio", icon: Home },
  { id: "clientes" as const, label: "Clientes", icon: Users },
  { id: "inventario" as const, label: "Inventario", icon: Package },
  { id: "ventas" as const, label: "Ventas", icon: CreditCard },
  { id: "prestamos" as const, label: "Préstamos", icon: Banknote },
  { id: "cobranza" as const, label: "Control de cobranza", icon: ClipboardList },
  { id: "compras" as const, label: "Compras", icon: ReceiptText },
  { id: "configuracion" as const, label: "Ajustes", icon: Settings },
];

export function FinancialDashboard() {
  return (
    <AuthGate>
      {(user, logout) => <DashboardApp userEmail={user.email ?? "Usuario"} logout={logout} />}
    </AuthGate>
  );
}

function DashboardApp({ userEmail, logout }: { userEmail: string; logout: () => Promise<void> }) {
  const [section, setSection] = useState<Section>("inicio");
  const [modal, setModal] = useState<Modal>(null);
  const [period, setPeriod] = useState<Period>("Hoy");
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [openSale, setOpenSale] = useState<string | null>(null);
  const [openLoan, setOpenLoan] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [printable, setPrintable] = useState<Printable>(null);
  useEffect(() => {
    let stop = () => {};
    subscribeAppData({
      products: setProducts,
      clients: setClients,
      sales: setSales,
      loans: setLoans,
      fichas: () => undefined,
      purchases: setPurchases,
      error: () =>
        setDataError(
          "No se pudieron sincronizar los datos. Revisa las reglas de acceso de Firestore.",
        ),
    })
      .then((unsubscribe) => {
        stop = unsubscribe;
        setLoadingData(false);
      })
      .catch(() => {
        setDataError("No se pudo conectar con Firestore.");
        setLoadingData(false);
      });
    return () => stop();
  }, []);
  const totals = useMemo(() => {
    const financed = [
      ...sales.map((item) => item.financed),
      ...loans.map((item) => item.total),
    ].reduce((sum, value) => sum + value, 0);
    const collected = [...sales, ...loans].reduce(
      (sum, item) =>
        sum +
        item.installments.reduce(
          (subtotal, payment) =>
            subtotal +
            (payment.paid ? payment.amount : Math.min(payment.amount, payment.paidAmount ?? 0)),
          0,
        ),
      0,
    );
    return { financed, collected, pending: financed - collected };
  }, [sales, loans]);
  const progress = totals.financed ? Math.round((totals.collected / totals.financed) * 100) : 0;
  const openModal = (type: Exclude<Modal, null>) => {
    setQuickOpen(false);
    setEditingClient(null);
    setEditingProduct(null);
    setModal(type);
  };
  const togglePayment = async (kind: "sale" | "loan", id: string, number: number) => {
    const source = kind === "sale" ? sales : loans;
    const current = source.find((item) => item.id === id);
    if (!current) return;
    const updated = {
      ...current,
      installments: current.installments.map((payment) =>
        payment.number === number ? { ...payment, paid: !payment.paid } : payment,
      ),
    };
    try {
      await savePayment(kind, updated);
    } catch {
      setDataError("No se pudo actualizar la cuota.");
    }
  };
  const applyCollectionPayment = async (
    kind: "sale" | "loan",
    id: string,
    number: number,
    amount: number,
  ) => {
    const source = kind === "sale" ? sales : loans;
    const current = source.find((item) => item.id === id);
    if (!current) return;
    const updated = {
      ...current,
      installments: current.installments.map((payment) => {
        if (payment.number !== number) return payment;
        const paidAmount = Math.min(
          payment.amount,
          Math.max(0, (payment.paidAmount ?? (payment.paid ? payment.amount : 0)) + amount),
        );
        return { ...payment, paidAmount, paid: paidAmount >= payment.amount };
      }),
    };
    try {
      await savePayment(kind, updated);
    } catch {
      setDataError("No se pudo registrar el abono.");
    }
  };
  return (
    <div className="min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar section={section} onNavigate={setSection} />
      <main className="mx-auto min-h-screen max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-9">
        <Header section={section} userEmail={userEmail} logout={logout} />
        {dataError && (
          <p
            role="alert"
            className="mb-5 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
          >
            {dataError}
          </p>
        )}
        {loadingData && (
          <p className="mb-5 text-sm text-muted-foreground">Sincronizando información…</p>
        )}
        {section === "inicio" && (
          <Dashboard
            period={period}
            setPeriod={setPeriod}
            totals={totals}
            progress={progress}
            clients={clients}
            products={products}
            sales={sales}
            loans={loans}
            openModal={openModal}
            setSection={setSection}
          />
        )}
        {section === "clientes" && (
          <ClientsView
            clients={clients}
            sales={sales}
            loans={loans}
            openModal={() => openModal("cliente")}
            editClient={(client) => {
              setEditingClient(client);
              setModal("cliente");
            }}
            saveFinancing={saveFinancingEdit}
          />
        )}
        {section === "inventario" && (
          <InventoryView
            products={products}
            purchases={purchases}
            openModal={() => openModal("producto")}
            editProduct={(product) => {
              setEditingProduct(product);
              setModal("producto");
            }}
          />
        )}
        {section === "ventas" && (
          <SalesView
            sales={sales}
            clients={clients}
            openItem={openSale}
            setOpenItem={setOpenSale}
            togglePayment={(id, number) => togglePayment("sale", id, number)}
            openModal={() => openModal("venta")}
            openPrint={(item) => setPrintable({ kind: "sale", item })}
          />
        )}
        {section === "prestamos" && (
          <LoansView
            loans={loans}
            clients={clients}
            openItem={openLoan}
            setOpenItem={setOpenLoan}
            togglePayment={(id, number) => togglePayment("loan", id, number)}
            openModal={() => openModal("prestamo")}
            openPrint={(item) => setPrintable({ kind: "loan", item })}
          />
        )}
        {section === "cobranza" && (
          <CollectionsView
            sales={sales}
            loans={loans}
            clients={clients}
            applyPayment={applyCollectionPayment}
          />
        )}
        {section === "compras" && (
          <PurchasesView purchases={purchases} openModal={() => openModal("compra")} />
        )}
        {section === "configuracion" && <SettingsView />}
      </main>
      <MobileNav section={section} onNavigate={setSection} />
      <div className="fixed bottom-24 right-5 z-40 lg:bottom-8 lg:right-8">
        {quickOpen && (
          <div className="absolute bottom-16 right-0 w-52 rounded-2xl border border-border bg-card p-2 shadow-xl">
            <Button
              variant="ghost"
              className="w-full justify-start rounded-xl"
              onClick={() => openModal("venta")}
            >
              <ShoppingBag /> Registrar venta
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start rounded-xl"
              onClick={() => openModal("prestamo")}
            >
              <Banknote /> Nuevo préstamo
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start rounded-xl"
              onClick={() => {
                setQuickOpen(false);
                setSection("ventas");
              }}
            >
              <CircleDollarSign /> Registrar cobro
            </Button>
          </div>
        )}
        <Button
          size="icon"
          aria-label="Abrir acciones rápidas"
          title="Acciones rápidas"
          onClick={() => setQuickOpen((value) => !value)}
          className="h-14 w-14 rounded-full shadow-lg"
        >
          {quickOpen ? <X /> : <Calculator />}
        </Button>
      </div>
      <ActionModal
        type={modal}
        editingClient={editingClient}
        editingProduct={editingProduct}
        onClose={() => {
          setModal(null);
          setEditingClient(null);
          setEditingProduct(null);
        }}
        products={products}
        clients={clients}
        saveClient={saveClient}
        addProduct={saveProduct}
        addSale={async (sale, clientName) => {
          await saveSale(sale, clientName);
          setPrintable({ kind: "sale", item: sale });
        }}
        addLoan={async (loan) => {
          const client = clients.find((item) => item.id === loan.clientId);
          await saveLoan(loan, client?.name ?? "Cliente");
          setPrintable({ kind: "loan", item: loan });
        }}
        addPurchase={savePurchase}
      />
      <PrintSheet printable={printable} clients={clients} onClose={() => setPrintable(null)} />
    </div>
  );
}

function Sidebar({
  section,
  onNavigate,
}: {
  section: Section;
  onNavigate: (section: Section) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar px-5 py-7 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <WalletCards />
        </span>
        <div>
          <p className="text-lg font-bold">Credihogar</p>
          <p className="text-xs text-muted-foreground">Tumeremo</p>
        </div>
      </div>
      <nav className="mt-10 space-y-1" aria-label="Navegación principal">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "h-11 w-full justify-start rounded-xl px-3",
                section === item.id &&
                  "bg-sidebar-accent text-sidebar-primary shadow-sm hover:bg-sidebar-accent",
              )}
            >
              <Icon />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
function MobileNav({
  section,
  onNavigate,
}: {
  section: Section;
  onNavigate: (section: Section) => void;
}) {
  const items = [
    { id: "inicio" as const, label: "Inicio", icon: Home },
    { id: "clientes" as const, label: "Clientes", icon: Users },
    { id: "ventas" as const, label: "Ventas", icon: CreditCard },
    { id: "cobranza" as const, label: "Cobranza", icon: ClipboardList },
    { id: "compras" as const, label: "Compras", icon: ReceiptText },
  ];
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl border border-border bg-card/90 px-1 pb-[max(.55rem,env(safe-area-inset-bottom))] pt-2 shadow-xl backdrop-blur-xl lg:hidden"
      aria-label="Navegación principal móvil"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            variant="ghost"
            onClick={() => onNavigate(item.id)}
            className={cn(
              "h-12 flex-col gap-1 rounded-xl px-0.5 text-[9px]",
              section === item.id ? "bg-secondary text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}
function Header({
  section,
  userEmail,
  logout,
}: {
  section: Section;
  userEmail: string;
  logout: () => Promise<void>;
}) {
  const titles: Record<Section, [string, string]> = {
    inicio: ["Panel financiero", "Este es el pulso financiero de tu negocio."],
    clientes: ["Clientes", "Administra la información de cada comprador."],
    inventario: ["Inventario", "Controla existencias, precios y disponibilidad."],
    ventas: ["Ventas financiadas", "Gestiona productos vendidos y sus cuotas."],
    prestamos: ["Préstamos directos", "Controla créditos en efectivo y calendarios de pago."],
    cobranza: [
      "Control de cobranza",
      "Pagos realizados y próximos vencimientos en orden cronológico.",
    ],
    compras: ["Compras", "Registra y consulta las compras de mercancía a proveedores."],
    configuracion: ["Configuración", "Personaliza la información de tu negocio."],
  };
  return (
    <header className="mb-7 flex items-start justify-between gap-4">
      <div>
        <div className="mb-3 flex items-center gap-2 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <WalletCards className="h-5 w-5" />
          </span>
          <strong>Credihogar Tumeremo</strong>
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{titles[section][0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{titles[section][1]}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:block">
          {userEmail}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          onClick={() => void logout()}
        >
          <LogOut />
        </Button>
      </div>
    </header>
  );
}

function Dashboard({
  period,
  setPeriod,
  totals,
  progress,
  clients,
  products,
  sales,
  loans,
  openModal,
  setSection,
}: {
  period: Period;
  setPeriod: (period: Period) => void;
  totals: { financed: number; collected: number; pending: number };
  progress: number;
  clients: Client[];
  products: Product[];
  sales: Sale[];
  loans: Loan[];
  openModal: (type: Exclude<Modal, null>) => void;
  setSection: (section: Section) => void;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [currentDate, setCurrentDate] = useState(today);
  useEffect(() => setCurrentDate(localToday()), []);
  const periods: Period[] = ["Hoy", "Ayer", "Últimos 7 días", "Este mes"];
  const actions = [
    { title: "Crear cliente", icon: UserPlus, tone: "bg-action-mint", type: "cliente" as const },
    { title: "Crear venta", icon: ShoppingBag, tone: "bg-action-yellow", type: "venta" as const },
    { title: "Crear préstamo", icon: Banknote, tone: "bg-action-blue", type: "prestamo" as const },
  ];
  return (
    <div className="space-y-7">
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold">Filtro de fechas</h2>
          <p className="flex items-center gap-2 text-xs font-semibold text-primary">
            <CalendarDays className="h-3.5 w-3.5" />
            {fullDisplayDate(currentDate)}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {periods.map((item) => (
            <Button
              key={item}
              variant={period === item ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(item)}
              className="shrink-0 rounded-xl px-4"
            >
              {item === "Hoy" ? fullDisplayDate(currentDate) : item}
            </Button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-bold">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            onClick={() => setSection("cobranza")}
            className="h-28 flex-col items-start justify-between rounded-2xl bg-action-pink p-3"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-card/80">
              <ClipboardList />
            </span>
            <span className="text-xs font-bold sm:text-sm">Control de cobranza</span>
          </Button>
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
      <section>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Progreso de cobros</p>
              <p className="mt-1 text-xs text-muted-foreground">Toca para ver el desglose</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Ver desglose"
              onClick={() => setShowBreakdown((value) => !value)}
            >
              {showBreakdown ? <ChevronUp /> : <TrendingUp />}
            </Button>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold">
            {money(totals.collected)}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              de {money(totals.financed)}
            </span>
          </h2>
          <div className="mt-5 flex justify-between text-xs">
            <span className="font-bold text-primary">Meta del período</span>
            <span className="rounded-lg bg-secondary px-2 py-1 font-bold text-primary">
              {progress}%
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5">
            <Metric label="Pendiente" value={money(totals.pending)} dot="bg-warning" />
            <Metric label="Cobrado" value={money(totals.collected)} dot="bg-primary" />
          </div>
          {showBreakdown && (
            <div className="mt-5 grid gap-2 border-t border-border pt-5 sm:grid-cols-2">
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Ventas activas</p>
                <p className="mt-1 font-bold">{sales.length}</p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Préstamos activos</p>
                <p className="mt-1 font-bold">{loans.length}</p>
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Users}
          label="Clientes"
          value={String(clients.length)}
          onClick={() => setSection("clientes")}
        />
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
        <SummaryCard
          icon={Banknote}
          label="Préstamos"
          value={String(loans.length)}
          onClick={() => setSection("prestamos")}
        />
      </section>
    </div>
  );
}
function Metric({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
function SummaryCard({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="h-auto justify-start rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <span className="mr-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
        <Icon />
      </span>
      <span className="text-left">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block text-2xl font-bold">{value}</span>
      </span>
    </Button>
  );
}

function ClientsView({
  clients,
  sales,
  loans,
  openModal,
  editClient,
  saveFinancing,
}: {
  clients: Client[];
  sales: Sale[];
  loans: Loan[];
  openModal: () => void;
  editClient: (client: Client) => void;
  saveFinancing: (kind: "sale" | "loan", item: Sale | Loan, client: Client) => Promise<void>;
}) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const normalizedSearch = clientSearch.trim().toLocaleLowerCase("es");
  const filteredClients = clients.filter((client) =>
    [client.name, client.clientCode, client.document].some((value) =>
      value.toLocaleLowerCase("es").includes(normalizedSearch),
    ),
  );
  return (
    <>
      <PageCard title="Cartera de clientes" action="Nuevo cliente" onAction={openModal}>
        {clients.length ? (
          <>
            <div className="relative mb-4">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Buscar por nombre, ID o cédula..."
                aria-label="Buscar clientes por nombre, ID o cédula"
                maxLength={100}
                className="h-11 rounded-xl pl-10"
              />
            </div>
            {filteredClients.length ? (
              <div className="divide-y divide-border">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver perfil de ${client.name}`}
                    onClick={() => setSelectedClient(client)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedClient(client);
                      }
                    }}
                    className="flex cursor-pointer items-center gap-3 py-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary px-1 text-center text-[10px] font-bold leading-tight text-primary">
                      {client.clientCode}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.document} · {client.phone}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{client.address}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar ${client.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        editClient(client);
                      }}
                    >
                      <Pencil />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No se encontraron clientes con esa búsqueda." />
            )}
          </>
        ) : (
          <EmptyState text="Aún no hay clientes registrados." />
        )}
      </PageCard>
      <ClientProfile
        client={selectedClient}
        sales={sales}
        loans={loans}
        clients={clients}
        saveFinancing={saveFinancing}
        onClientUpdated={setSelectedClient}
        onClose={() => setSelectedClient(null)}
      />
    </>
  );
}

function ClientProfile({
  client,
  sales,
  loans,
  clients,
  saveFinancing,
  onClientUpdated,
  onClose,
}: {
  client: Client | null;
  sales: Sale[];
  loans: Loan[];
  clients: Client[];
  saveFinancing: (kind: "sale" | "loan", item: Sale | Loan, client: Client) => Promise<void>;
  onClientUpdated: (client: Client) => void;
  onClose: () => void;
}) {
  const [editingRecord, setEditingRecord] = useState<
    { kind: "sale"; item: Sale } | { kind: "loan"; item: Loan } | null
  >(null);
  if (!client) return null;
  const records = [
    ...sales
      .filter((sale) => sale.clientId === client.id)
      .map((sale) => ({
        id: sale.id,
        kind: "sale" as const,
        item: sale,
        reference: sale.invoice,
        origin: "Venta de Producto" as const,
        date: sale.date,
        total: sale.financed,
        installments: sale.installments,
      })),
    ...loans
      .filter((loan) => loan.clientId === client.id)
      .map((loan) => ({
        id: loan.id,
        kind: "loan" as const,
        item: loan,
        reference: loan.reference,
        origin: "Préstamo" as const,
        date: loan.date,
        total: loan.total,
        installments: loan.installments,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const allInstallments = records.flatMap((record) => record.installments);
  const overdue = allInstallments.filter(isInstallmentOverdue).length;
  const paid = allInstallments.filter(isInstallmentPaid).length;
  const pending = allInstallments.filter(isInstallmentPending).length;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Perfil del Cliente</DialogTitle>
            <DialogDescription>Estado de sus ventas financiadas y préstamos.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-4 border-b border-border pb-5">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-secondary px-2 text-center text-xs font-bold leading-tight text-primary">
              {client.clientCode}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-xl font-bold">{client.name}</h3>
              <p className="text-sm text-muted-foreground">
                {client.document} · {client.phone}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{client.address}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <DebtMetric label="Cuotas/Deudas Vencidas" value={overdue} tone="overdue" />
            <DebtMetric label="Cuotas Pagadas" value={paid} tone="paid" />
            <DebtMetric label="Cuotas Por Pagar" value={pending} tone="pending" />
          </div>
          <div>
            <h4 className="mb-3 font-bold">Origen del saldo</h4>
            {records.length ? (
              <div className="space-y-3">
                {records.map((record) => {
                  const amountPaid = record.installments.reduce(
                    (sum, payment) => sum + installmentPaidAmount(payment),
                    0,
                  );
                  const balance = Math.max(0, record.total - amountPaid);
                  const recordOverdue = record.installments.filter(isInstallmentOverdue).length;
                  const recordPending = record.installments.filter(isInstallmentPending).length;
                  const unpaidInstallments = record.installments.filter(
                    (payment) => !isInstallmentPaid(payment),
                  );
                  return (
                    <div
                      key={`${record.origin}-${record.id}`}
                      className="rounded-xl border border-border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <div>
                            <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
                              {record.origin}
                            </span>
                            <p className="mt-2 font-semibold">{record.reference}</p>
                            <p className="text-xs text-muted-foreground">
                              {displayDate(record.date)}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Editar ${record.reference}`}
                            title="Editar financiamiento"
                            onClick={() =>
                              record.kind === "sale"
                                ? setEditingRecord({ kind: "sale", item: record.item as Sale })
                                : setEditingRecord({ kind: "loan", item: record.item as Loan })
                            }
                          >
                            <Pencil />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                          <p className="text-lg font-bold">{money(balance)}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Financiado</p>
                          <strong>{money(record.total)}</strong>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pagado</p>
                          <strong>{money(amountPaid)}</strong>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Cuotas</p>
                          <strong>
                            {recordPending} pendientes · {recordOverdue} vencidas
                          </strong>
                        </div>
                      </div>
                      {unpaidInstallments.length > 0 && (
                        <div className="mt-4 border-t border-border pt-3">
                          <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                            Cuotas por pagar
                          </p>
                          <div className="divide-y divide-border rounded-lg border border-border">
                            {unpaidInstallments.map((payment) => {
                              const remaining = Math.max(
                                0,
                                payment.amount - installmentPaidAmount(payment),
                              );
                              const overduePayment = isInstallmentOverdue(payment);
                              return (
                                <div
                                  key={`${record.id}-cuota-${payment.number}`}
                                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                                >
                                  <div>
                                    <span className="font-semibold">Cuota Nº {payment.number}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      {displayDate(payment.due)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-xs font-bold",
                                        overduePayment
                                          ? "bg-destructive/10 text-destructive"
                                          : "bg-secondary text-secondary-foreground",
                                      )}
                                    >
                                      {overduePayment ? "Vencida" : "Pendiente"}
                                    </span>
                                    <strong>{money(remaining)}</strong>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="Este cliente aún no tiene ventas financiadas ni préstamos." />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <FinancingEditDialog
        record={editingRecord}
        client={client}
        clients={clients}
        onClose={() => setEditingRecord(null)}
        onSave={async (kind, item, updatedClient) => {
          await saveFinancing(kind, item, updatedClient);
          onClientUpdated(updatedClient);
          setEditingRecord(null);
        }}
      />
    </>
  );
}

function FinancingEditDialog({
  record,
  client,
  clients,
  onClose,
  onSave,
}: {
  record: { kind: "sale"; item: Sale } | { kind: "loan"; item: Loan } | null;
  client: Client;
  clients: Client[];
  onClose: () => void;
  onSave: (kind: "sale" | "loan", item: Sale | Loan, client: Client) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!record) return null;
  const total = record.kind === "sale" ? record.item.financed : record.item.total;
  const paidTotal = record.item.installments.reduce(
    (sum, payment) => sum + installmentPaidAmount(payment),
    0,
  );
  const paymentHistoryCount = record.item.installments.filter(
    (payment) => payment.paid || (payment.paidAmount ?? 0) > 0,
  ).length;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("clientName")).trim();
    const debt = Number(data.get("debt"));
    const count = Number(data.get("installmentCount"));
    if (!name || name.length > 100 || !Number.isInteger(count) || count < 1 || count > 120) {
      setError("Revisa el nombre y el número de cuotas.");
      return;
    }
    if (!Number.isFinite(debt) || debt < paidTotal) {
      setError(`La deuda no puede ser menor que lo ya pagado (${money(paidTotal)}).`);
      return;
    }
    if (count < paymentHistoryCount) {
      setError(`Debes conservar al menos ${paymentHistoryCount} cuotas con pagos registrados.`);
      return;
    }
    if (clients.some((entry) => entry.id !== client.id && entry.name === name)) {
      setError("Ya existe otro cliente con ese nombre.");
      return;
    }
    const installments = rebuildSchedulePreservingPayments(record.item, count, debt);
    const updatedItem =
      record.kind === "sale"
        ? { ...record.item, financed: debt, installments }
        : { ...record.item, total: debt, installments };
    setSubmitting(true);
    setError("");
    try {
      await onSave(record.kind, updatedItem, { ...client, name });
    } catch {
      setError("No se pudieron guardar los cambios.");
      setSubmitting(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar financiamiento</DialogTitle>
          <DialogDescription>
            Los pagos registrados se conservarán al recalcular las cuotas pendientes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field
            name="clientName"
            label="Nombre del cliente"
            defaultValue={client.name}
            maxLength={100}
          />
          <Field
            name="debt"
            label="Monto de deuda ($)"
            type="number"
            min={paidTotal}
            step="0.01"
            defaultValue={total}
          />
          <Field
            name="installmentCount"
            label="Número de cuotas"
            type="number"
            min="1"
            max="120"
            step="1"
            defaultValue={record.item.installments.length}
          />
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DebtMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "overdue" | "paid" | "pending";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        tone === "overdue" && "border-destructive/25 bg-destructive/10",
        tone === "paid" && "border-primary/25 bg-secondary",
        tone === "pending" && "border-warning/25 bg-action-yellow",
      )}
    >
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
function InventoryView({
  products,
  purchases,
  openModal,
  editProduct,
}: {
  products: Product[];
  purchases: Purchase[];
  openModal: () => void;
  editProduct: (product: Product) => void;
}) {
  const totalInvested = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  return (
    <div className="space-y-6">
      <PageCard title="Productos disponibles" action="Nuevo producto" onAction={openModal}>
        {products.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-3">CÓDIGO</th>
                  <th className="pb-3">ELECTRODOMÉSTICO</th>
                  <th className="pb-3">MARCA / CAPACIDAD</th>
                  <th className="pb-3">PRECIO</th>
                  <th className="pb-3">STOCK</th>
                  <th className="pb-3 text-right">ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.code} className="border-b border-border last:border-0">
                    <td className="py-4 font-mono text-xs">{product.code}</td>
                    <td className="py-4 font-semibold">{product.name}</td>
                    <td className="py-4 text-muted-foreground">
                      {product.brand} · {product.capacity}
                    </td>
                    <td className="py-4 font-semibold">{money(product.price)}</td>
                    <td className="py-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-bold",
                          product.stock
                            ? "bg-secondary text-primary"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {product.stock ? `${product.stock} unidades` : "Agotado"}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => editProduct(product)}
                        className="rounded-xl"
                      >
                        <Pencil /> Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="Aún no hay productos en el inventario." />
        )}
      </PageCard>
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Inventario</p>
            <h2 className="mt-1 text-lg font-bold">Control de Gastos e Inversión</h2>
          </div>
          <div className="rounded-xl bg-secondary px-4 py-3 text-right">
            <p className="text-xs text-muted-foreground">Total acumulado</p>
            <p className="text-xl font-bold text-primary">{money(totalInvested)}</p>
          </div>
        </div>
        <PurchaseHistory purchases={purchases} />
      </section>
    </div>
  );
}

function FinanceList<T extends Sale | Loan>({
  items,
  clients,
  openItem,
  setOpenItem,
  togglePayment,
  openPrint,
  kind,
}: {
  items: T[];
  clients: Client[];
  openItem: string | null;
  setOpenItem: (id: string | null) => void;
  togglePayment: (id: string, number: number) => void;
  openPrint: (item: T) => void;
  kind: "sale" | "loan";
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isOpen = openItem === item.id;
        const client = clients.find((clientItem) => clientItem.id === item.clientId);
        const paid = item.installments.filter((payment) => payment.paid).length;
        const saleItem = item as Sale;
        const title =
          kind === "sale"
            ? saleItem.items?.map((line) => line.productName).join(", ") || saleItem.productName
            : `Préstamo ${(item as Loan).reference}`;
        return (
          <div key={item.id} className="overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center gap-1 p-2 sm:p-3">
              <Button
                variant="ghost"
                onClick={() => setOpenItem(isOpen ? null : item.id)}
                className="h-auto min-w-0 flex-1 justify-between rounded-xl px-2 py-3 text-left"
              >
                <span className="min-w-0 whitespace-normal">
                  <span className="block font-bold">
                    {client
                      ? kind === "sale"
                        ? `${client.clientCode} - ${client.name}`
                        : `${client.name} · ${client.clientCode}`
                      : "Cliente"}
                  </span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {title} · {(item as Sale).frequency ?? (item as Loan).frequency}
                  </span>
                </span>
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                  {paid}/{item.installments.length}{" "}
                  {isOpen ? (
                    <ChevronUp className="ml-1 inline h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-1 inline h-4 w-4" />
                  )}
                </span>
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Ver ficha imprimible"
                title="Ficha imprimible"
                onClick={() => openPrint(item)}
              >
                <Printer />
              </Button>
            </div>
            {isOpen && (
              <div className="border-t border-border bg-muted/40 p-3">
                <p className="mb-3 text-xs text-muted-foreground">
                  Toca una cuota para cambiar su estado.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {item.installments.map((payment) => (
                    <Button
                      key={payment.number}
                      variant="outline"
                      onClick={() => togglePayment(item.id, payment.number)}
                      className={cn(
                        "h-auto justify-between rounded-xl p-3 text-left",
                        payment.paid && "border-primary/30 bg-secondary",
                      )}
                    >
                      <span>
                        <span className="block text-xs text-muted-foreground">
                          Cuota {payment.number} · {displayDate(payment.due)}
                        </span>
                        <span className="mt-1 block font-bold">{money(payment.amount)}</span>
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold",
                          payment.paid ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {payment.paid ? "PAGADO" : "PENDIENTE"}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
function SalesView({
  sales,
  clients,
  openItem,
  setOpenItem,
  togglePayment,
  openModal,
  openPrint,
}: {
  sales: Sale[];
  clients: Client[];
  openItem: string | null;
  setOpenItem: (id: string | null) => void;
  togglePayment: (id: string, number: number) => void;
  openModal: () => void;
  openPrint: (sale: Sale) => void;
}) {
  const [salesSearch, setSalesSearch] = useState("");
  const normalizedSearch = salesSearch.trim().toLocaleLowerCase("es");
  const filteredSales = sales.filter((sale) => {
    const client = clients.find((clientItem) => clientItem.id === sale.clientId);
    return [client?.name ?? "", client?.clientCode ?? ""].some((value) =>
      value.toLocaleLowerCase("es").includes(normalizedSearch),
    );
  });

  return (
    <PageCard title="Financiamientos de productos" action="Nueva venta" onAction={openModal}>
      <div className="relative mb-4 max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={salesSearch}
          onChange={(event) => setSalesSearch(event.target.value)}
          placeholder="Buscar por nombre o ID..."
          aria-label="Buscar ventas financiadas por nombre o ID"
          className="pl-9"
        />
      </div>
      <FinanceList
        items={filteredSales}
        clients={clients}
        openItem={openItem}
        setOpenItem={setOpenItem}
        togglePayment={togglePayment}
        openPrint={openPrint}
        kind="sale"
      />
    </PageCard>
  );
}
function LoansView({
  loans,
  clients,
  openItem,
  setOpenItem,
  togglePayment,
  openModal,
  openPrint,
}: {
  loans: Loan[];
  clients: Client[];
  openItem: string | null;
  setOpenItem: (id: string | null) => void;
  togglePayment: (id: string, number: number) => void;
  openModal: () => void;
  openPrint: (loan: Loan) => void;
}) {
  return (
    <PageCard title="Créditos directos" action="Nuevo préstamo" onAction={openModal}>
      <FinanceList
        items={loans}
        clients={clients}
        openItem={openItem}
        setOpenItem={setOpenItem}
        togglePayment={togglePayment}
        openPrint={openPrint}
        kind="loan"
      />
    </PageCard>
  );
}
function CollectionsView({
  sales,
  loans,
  clients,
  applyPayment,
}: {
  sales: Sale[];
  loans: Loan[];
  clients: Client[];
  applyPayment: (
    kind: "sale" | "loan",
    id: string,
    number: number,
    amount: number,
  ) => Promise<void>;
}) {
  const [paymentTarget, setPaymentTarget] = useState<{
    kind: "sale" | "loan";
    id: string;
    number: number;
    client: string;
    remaining: number;
  } | null>(null);
  const [partialAmount, setPartialAmount] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedWeekday, setSelectedWeekday] = useState("all");
  const [collectionSearch, setCollectionSearch] = useState("");
  const weekdayOptions = [
    { value: "all", label: "Todos los días" },
    { value: "1", label: "Lunes" },
    { value: "2", label: "Martes" },
    { value: "3", label: "Miércoles" },
    { value: "4", label: "Jueves" },
    { value: "5", label: "Viernes" },
    { value: "6", label: "Sábado" },
    { value: "0", label: "Domingo" },
  ];
  const rows = [
    ...sales.map((item) => ({ kind: "sale" as const, item, financed: item.financed })),
    ...loans.map((item) => ({ kind: "loan" as const, item, financed: item.total })),
  ]
    .flatMap((entry) => {
      const client = clients.find((candidate) => candidate.id === entry.item.clientId);
      const paidTotal = entry.item.installments.reduce(
        (sum, payment) => sum + installmentPaidAmount(payment),
        0,
      );
      const balance = Math.max(0, entry.financed - paidTotal);
      return entry.item.installments
        .filter((payment) => !isInstallmentPaid(payment))
        .map((payment) => ({ ...entry, client, payment, paidTotal, balance }));
    })
    .sort((a, b) => a.payment.due.localeCompare(b.payment.due));
  const normalizedCollectionSearch = collectionSearch.trim().toLocaleLowerCase("es");
  const filteredRows = rows.filter((row) => {
    const matchesWeekday =
      selectedWeekday === "all" ||
      new Date(`${row.payment.due}T12:00:00`).getDay() === Number(selectedWeekday);
    const matchesSearch =
      !normalizedCollectionSearch ||
      (row.client?.name ?? "").toLocaleLowerCase("es").includes(normalizedCollectionSearch) ||
      (row.client?.clientCode ?? "").toLocaleLowerCase("es").includes(normalizedCollectionSearch);
    return matchesWeekday && matchesSearch;
  });
  const weekday = (
    weekdayOptions.find((option) => option.value === selectedWeekday)?.label ?? "Todos los días"
  ).toLocaleUpperCase("es");
  const reportTitle =
    selectedWeekday === "all" ? "CONTROL COBRANZA" : `CONTROL COBRANZA - ${weekday}`;
  const issuedAt = fullDisplayDate(localToday());
  const printReport = () => {
    document.body.classList.add("printing-collections");
    window.print();
    document.body.classList.remove("printing-collections");
  };
  const pay = async (amount: number) => {
    if (!paymentTarget || amount <= 0) return;
    setSubmitting(true);
    await applyPayment(paymentTarget.kind, paymentTarget.id, paymentTarget.number, amount);
    setSubmitting(false);
    setPaymentTarget(null);
    setPartialAmount("");
  };
  return (
    <>
      <section className="collections-screen overflow-hidden border border-border bg-card shadow-sm">
        <header className="px-4 py-6 text-center">
          <h2 className="text-2xl font-black text-collection-brand sm:text-3xl">
            CREDIHOGAR TUMEREMO
          </h2>
          <p className="mt-1 text-sm font-bold text-muted-foreground">CONTROL COBRANZA</p>
          <div className="mx-auto mt-5 grid max-w-4xl items-end gap-3 text-left sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
            <div>
              <Label htmlFor="collections-weekday" className="mb-2 block text-xs font-bold">
                Filtrar por día de pago
              </Label>
              <select
                id="collections-weekday"
                className="form-control"
                value={selectedWeekday}
                onChange={(event) => setSelectedWeekday(event.target.value)}
              >
                {weekdayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="collections-search" className="mb-2 block text-xs font-bold">
                Buscar cliente
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="collections-search"
                  value={collectionSearch}
                  onChange={(event) => setCollectionSearch(event.target.value)}
                  placeholder="Buscar por nombre o ID de cliente..."
                  className="h-11 rounded-xl bg-background pl-10"
                />
              </div>
            </div>
            <Button onClick={printReport} disabled={!filteredRows.length} className="h-11 rounded-xl">
              <Printer /> Imprimir Reporte
            </Button>
          </div>
        </header>
        <div className="bg-collection-header px-4 py-2 text-center text-sm font-black text-primary-foreground">
          DÍA: {weekday}
        </div>
        {filteredRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-xs">
              <thead className="bg-collection-header text-primary-foreground">
                <tr>
                  {[
                    "ID CLIENTE",
                    "FECHA",
                    "CUOTA Nº",
                    "CLIENTE",
                    "PRÉSTAMO / FINANCIADO",
                    "MONTO",
                    "MONTO PAGADO",
                    "SALDO",
                    "STATUS",
                    "ACCIONES",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border border-border px-3 py-3 text-left font-bold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const installmentPaid = installmentPaidAmount(row.payment);
                  const remaining = Math.max(0, row.payment.amount - installmentPaid);
                  return (
                    <tr
                      key={`${row.kind}-${row.item.id}-${row.payment.number}`}
                      className={index % 2 ? "bg-muted/40" : "bg-card"}
                    >
                      <td className="border border-border px-3 py-3 font-mono font-bold">
                        {row.client?.clientCode ?? "—"}
                      </td>
                      <td className="border border-border px-3 py-3">
                        {displayDate(row.payment.due)}
                      </td>
                      <td className="border border-border px-3 py-3 text-center font-bold">
                        {row.payment.number}
                      </td>
                      <td className="border border-border px-3 py-3 font-bold">
                        {(row.client?.name ?? "CLIENTE").toLocaleUpperCase("es")}
                      </td>
                      <td className="border border-border px-3 py-3">{money(row.financed)}</td>
                      <td className="border border-border px-3 py-3 font-bold">
                        {money(row.payment.amount)}
                      </td>
                      <td className="border border-border px-3 py-3">{money(row.paidTotal)}</td>
                      <td className="border border-border px-3 py-3 font-bold">
                        {money(row.balance)}
                      </td>
                      <td className="border border-border px-3 py-3">
                        <InstallmentStatus payment={row.payment} />
                      </td>
                      <td className="border border-border px-3 py-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPaymentTarget({
                                kind: row.kind,
                                id: row.item.id,
                                number: row.payment.number,
                                client: row.client?.name ?? "Cliente",
                                remaining,
                              });
                              setPartialAmount("");
                            }}
                            className="h-8 rounded-sm"
                          >
                            Abonar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              void applyPayment(
                                row.kind,
                                row.item.id,
                                row.payment.number,
                                remaining,
                              )
                            }
                            className="h-8 rounded-sm"
                          >
                            Pagar todo
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            text={
              selectedWeekday === "all" && !normalizedCollectionSearch
                ? "No hay cuotas pendientes de pago."
                : "No hay resultados para los filtros seleccionados."
            }
          />
        )}
      </section>
      <section id="collections-print-report" aria-hidden="true">
        <header className="collections-report-header">
          <h1>CREDIHOGAR TUMEREMO - {reportTitle}</h1>
          <div className="collections-report-meta">
            <span>FECHA DE EMISIÓN: {issuedAt.toLocaleUpperCase("es")}</span>
            <span>DÍA FILTRADO: {weekday}</span>
          </div>
        </header>
        <table className="collections-report-table">
          <thead>
            <tr>
              {[
                "ID CLIENTE",
                "FECHA",
                "CUOTA Nº",
                "CLIENTE",
                "PRÉSTAMO / FINANCIADO",
                "MONTO",
                "MONTO PAGADO",
                "SALDO",
                "STATUS",
              ].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const paid = isInstallmentPaid(row.payment);
              const overdue = isInstallmentOverdue(row.payment);
              return (
                <tr key={`report-${row.kind}-${row.item.id}-${row.payment.number}`}>
                  <td>{row.client?.clientCode ?? "—"}</td>
                  <td>{displayDate(row.payment.due)}</td>
                  <td>{row.payment.number}</td>
                  <td>{(row.client?.name ?? "CLIENTE").toLocaleUpperCase("es")}</td>
                  <td>{money(row.financed)}</td>
                  <td>{money(row.payment.amount)}</td>
                  <td>{money(row.paidTotal)}</td>
                  <td>{money(row.balance)}</td>
                  <td>{paid ? "PAGADA" : overdue ? "VENCIDA" : "PENDIENTE"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <Dialog
        open={Boolean(paymentTarget)}
        onOpenChange={(open) => {
          if (!open) setPaymentTarget(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar abono</DialogTitle>
            <DialogDescription>
              {paymentTarget?.client} · Cuota {paymentTarget?.number} · Pendiente{" "}
              {money(paymentTarget?.remaining ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <NumberControl
            label="Monto a abonar ($)"
            value={partialAmount}
            setValue={setPartialAmount}
            min={0.01}
            {...(paymentTarget ? { max: paymentTarget.remaining } : {})}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={submitting || typeof partialAmount !== "number" || partialAmount <= 0}
              onClick={() => void pay(typeof partialAmount === "number" ? partialAmount : 0)}
            >
              {submitting ? "Guardando…" : "Registrar abono"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InstallmentStatus({ payment }: { payment: Installment }) {
  const paidAmount = payment.paidAmount ?? 0;
  const paid = payment.paid || paidAmount >= payment.amount;
  const overdue = !paid && payment.due < localToday();
  const label = paid ? "Pagada" : overdue ? "Vencida" : "Pendiente";
  return (
    <span
      className={cn(
        "inline-flex rounded-sm px-2 py-1 text-[10px] font-bold uppercase",
        paid
          ? "bg-secondary text-primary"
          : overdue
            ? "bg-destructive/10 text-destructive"
            : "bg-action-yellow text-foreground",
      )}
    >
      {label}
    </span>
  );
}

function PurchaseHistory({ purchases }: { purchases: Purchase[] }) {
  if (!purchases.length) return <EmptyState text="No hay compras registradas." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="pb-3">FACTURA</th>
            <th className="pb-3">FECHA</th>
            <th className="pb-3">PROVEEDOR</th>
            <th className="pb-3">PRODUCTO</th>
            <th className="pb-3 text-center">CANTIDAD</th>
            <th className="pb-3 text-right">COSTO UNITARIO</th>
            <th className="pb-3 text-right">TOTAL INVERTIDO</th>
          </tr>
        </thead>
        <tbody>
          {purchases.flatMap((purchase) =>
            purchase.items.map((item, index) => (
              <tr
                key={`${purchase.id}-${item.productCode}`}
                className="border-b border-border last:border-0"
              >
                <td className="py-4 font-mono text-xs">
                  {index === 0 ? (purchase.invoice ?? "—") : "—"}
                </td>
                <td className="py-4">{index === 0 ? displayDate(purchase.date) : "—"}</td>
                <td className="py-4 font-semibold">{index === 0 ? purchase.supplier : "—"}</td>
                <td className="py-4">{item.productName}</td>
                <td className="py-4 text-center">{item.quantity}</td>
                <td className="py-4 text-right">{money(item.unitCost)}</td>
                <td className="py-4 text-right font-bold">{money(item.subtotal)}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function PurchasesView({ purchases, openModal }: { purchases: Purchase[]; openModal: () => void }) {
  const [search, setSearch] = useState("");
  const normalized = search.trim().toLocaleLowerCase("es");

  const filteredPurchases = purchases.filter(
    (purchase) =>
      !normalized ||
      purchase.supplier.toLocaleLowerCase("es").includes(normalized) ||
      (purchase.invoice ?? "").toLocaleLowerCase("es").includes(normalized) ||
      purchase.items.some((item) =>
        item.productName.toLocaleLowerCase("es").includes(normalized),
      ) ||
      purchase.date.includes(normalized),
  );

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar compras"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por factura, proveedor, producto o fecha..."
            className="h-10 rounded-xl bg-card pl-10"
          />
        </div>
        <Button onClick={openModal} className="rounded-xl">
          <Plus /> Registrar compra
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-lg font-bold">Historial de compras</h3>
          <div className="rounded-xl bg-secondary px-4 py-3 text-right">
            <p className="text-xs text-muted-foreground">Total invertido</p>
            <p className="text-xl font-bold text-primary">
              {money(filteredPurchases.reduce((sum, purchase) => sum + purchase.total, 0))}
            </p>
          </div>
        </div>
        <PurchaseHistory purchases={filteredPurchases} />
      </div>
    </section>
  );
}
function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
function SettingsView() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <Settings />
      <h2 className="mt-5 text-xl font-bold">Datos del negocio</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Credihogar Tumeremo · Moneda USD · Información sincronizada con Cloud Firestore.
      </p>
    </div>
  );
}
function PageCard({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <Button onClick={onAction} className="rounded-xl">
          <Plus />
          <span className="hidden sm:inline">{action}</span>
        </Button>
      </div>
      {children}
    </section>
  );
}

function ActionModal({
  type,
  editingClient,
  editingProduct,
  onClose,
  products,
  clients,
  saveClient: persistClient,
  addProduct,
  addSale,
  addLoan,
  addPurchase,
}: {
  type: Modal;
  editingClient: Client | null;
  editingProduct: Product | null;
  onClose: () => void;
  products: Product[];
  clients: Client[];
  saveClient: (client: Client) => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  addSale: (sale: Sale, clientName: string) => Promise<void>;
  addLoan: (loan: Loan) => Promise<void>;
  addPurchase: (purchase: Purchase) => Promise<void>;
}) {
  const [productToAdd, setProductToAdd] = useState("");
  const [saleItems, setSaleItems] = useState<SaleLineItem[]>([]);
  const [installments, setInstallments] = useState<number | "">(3);
  const installmentCount = typeof installments === "number" ? installments : 0;
  const [frequency, setFrequency] = useState<Frequency>("Mensual");
  const [saleDate, setSaleDate] = useState(localToday);
  const [downPayment, setDownPayment] = useState(0);
  const [loanAmount, setLoanAmount] = useState(500);
  const [interestRate, setInterestRate] = useState(20);
  const [skipSaturday, setSkipSaturday] = useState(false);
  const [skipSunday, setSkipSunday] = useState(false);
  const [error, setError] = useState("");
  const [quickProductOpen, setQuickProductOpen] = useState(false);
  const [quickProductError, setQuickProductError] = useState("");
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientError, setQuickClientError] = useState("");
  const [quickCreatedClient, setQuickCreatedClient] = useState<Client | null>(null);
  const [selectedSaleClientId, setSelectedSaleClientId] = useState("");
  const saleClients = quickCreatedClient
    ? [quickCreatedClient, ...clients.filter((client) => client.id !== quickCreatedClient.id)]
    : clients;
  const saleTotal = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
  const financed = Math.max(0, saleTotal - downPayment);
  const salePreview =
    saleItems.length && installmentCount
      ? createSchedule(saleDate, installmentCount, financed, frequency)
      : [];
  const loanTotal = loanAmount * (1 + interestRate / 100);
  const loanPreview = installmentCount
    ? createSchedule(saleDate, installmentCount, loanTotal, frequency, skipSaturday, skipSunday)
    : [];
  const addSelectedProduct = () => {
    const product = products.find((item) => item.code === productToAdd);
    if (
      !product ||
      (type !== "compra" && product.stock < 1) ||
      saleItems.some((item) => item.productCode === product.code)
    )
      return;
    setSaleItems((current) => [
      ...current,
      {
        productCode: product.code,
        productName: product.name,
        brand: product.brand,
        capacity: product.capacity,
        quantity: 1,
        unitPrice: product.price,
        subtotal: product.price,
      },
    ]);
    setProductToAdd("");
  };
  const updateSaleItem = (
    code: string,
    values: Partial<Pick<SaleLineItem, "quantity" | "unitPrice">>,
  ) => {
    setSaleItems((current) =>
      current.map((item) => {
        if (item.productCode !== code) return item;
        const quantity = values.quantity ?? item.quantity;
        const unitPrice = values.unitPrice ?? item.unitPrice;
        return {
          ...item,
          quantity,
          unitPrice,
          subtotal: Math.round(quantity * unitPrice * 100) / 100,
        };
      }),
    );
  };
  const createQuickProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuickProductError("");
    const data = new FormData(event.currentTarget);
    const product: Product = {
      code: String(data.get("quickCode")).trim().toUpperCase(),
      name: String(data.get("quickName")).trim(),
      category: String(data.get("quickCategory")).trim(),
      brand: String(data.get("quickBrand")).trim(),
      capacity: String(data.get("quickCapacity")).trim(),
      price: Number(data.get("quickPrice")),
      stock: 0,
    };
    if (products.some((item) => item.code === product.code)) {
      setQuickProductError("El código de producto ya está registrado.");
      return;
    }
    if (
      !product.code ||
      !product.name ||
      !product.category ||
      !product.brand ||
      product.price <= 0
    ) {
      setQuickProductError("Completa los campos obligatorios con valores válidos.");
      return;
    }
    try {
      await addProduct(product);
      setProductToAdd(product.code);
      setSaleItems((current) => [
        ...current,
        {
          productCode: product.code,
          productName: product.name,
          brand: product.brand,
          capacity: product.capacity,
          quantity: 1,
          unitPrice: product.price,
          subtotal: product.price,
        },
      ]);
      setQuickProductOpen(false);
    } catch (cause) {
      setQuickProductError(
        cause instanceof Error ? cause.message : "No se pudo crear el producto.",
      );
    }
  };
  const createQuickClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuickClientError("");
    const data = new FormData(event.currentTarget);
    const code = String(data.get("quickClientCode")).trim().toUpperCase();
    const client: Client = {
      id: `c${Date.now()}`,
      clientCode: code,
      name: String(data.get("quickClientName")).trim(),
      phone: String(data.get("quickClientPhone")).trim(),
      document: String(data.get("quickClientDocument")).trim(),
      address: String(data.get("quickClientAddress")).trim(),
    };
    if (clients.some((item) => item.clientCode.toUpperCase() === code)) {
      setQuickClientError("El ID de cliente ya está registrado.");
      return;
    }
    if (
      !client.clientCode ||
      !client.name ||
      !client.phone ||
      !client.document ||
      !client.address
    ) {
      setQuickClientError("Completa todos los datos obligatorios del cliente.");
      return;
    }
    try {
      await persistClient(client);
      setQuickCreatedClient(client);
      setSelectedSaleClientId(client.id);
      setQuickClientOpen(false);
    } catch (cause) {
      setQuickClientError(
        cause instanceof Error ? cause.message : "No se pudo guardar el cliente.",
      );
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      if (type === "cliente") {
        const code = String(data.get("clientCode")).trim().toUpperCase();
        if (clients.some((item) => item.id !== editingClient?.id && item.clientCode === code)) {
          setError("El ID de cliente ya está registrado.");
          return;
        }
        await persistClient({
          id: editingClient?.id ?? `c${Date.now()}`,
          clientCode: code,
          name: String(data.get("name")).trim(),
          phone: String(data.get("phone")).trim(),
          document: String(data.get("document")).trim(),
          address: String(data.get("address")).trim(),
        });
      }
      if (type === "producto") {
        const code = String(data.get("code")).trim().toUpperCase();
        if (!editingProduct && products.some((item) => item.code === code)) {
          setError("El código de producto ya está registrado.");
          return;
        }
        await addProduct({
          code: editingProduct?.code ?? code,
          name: String(data.get("name")).trim(),
          category: String(data.get("category")).trim(),
          brand: String(data.get("brand")).trim(),
          capacity: String(data.get("capacity")).trim(),
          price: Number(data.get("price")),
          stock: Number(data.get("stock")),
        });
      }
      if (type === "venta") {
        if (!selectedSaleClientId) {
          setError("Selecciona o agrega un cliente para la venta.");
          return;
        }
        if (!saleItems.length) {
          setError("Añade al menos un producto a la venta.");
          return;
        }
        if (saleItems.some((line) => line.quantity < 1 || line.unitPrice <= 0)) {
          setError("Revisa las cantidades y precios de los productos.");
          return;
        }
        if (downPayment > saleTotal) {
          setError("La inicial no puede superar el costo total.");
          return;
        }
        const first = saleItems[0];
        if (!first) return;
        const sale: Sale = {
          id: `s${Date.now()}`,
          invoice: String(data.get("invoice")).trim(),
          clientId: selectedSaleClientId,
          productCode: first.productCode,
          productName: saleItems.map((line) => line.productName).join(", "),
          brand: saleItems
            .map((line) => line.brand)
            .filter(Boolean)
            .join(", "),
          capacity: saleItems
            .map((line) => line.capacity)
            .filter(Boolean)
            .join(", "),
          total: saleTotal,
          downPayment,
          financed,
          date: saleDate,
          frequency: frequency as Exclude<Frequency, "Diario">,
          installments: salePreview,
          items: saleItems,
        };
        const saleClient = saleClients.find((client) => client.id === selectedSaleClientId);
        await addSale(sale, saleClient?.name ?? "Cliente");
      }
      if (type === "compra") {
        if (!saleItems.length) {
          setError("Añade al menos un producto a la compra.");
          return;
        }
        const purchase: Purchase = {
          id: `p${Date.now()}`,
          invoice: String(data.get("purchaseInvoice")).trim(),
          date: saleDate,
          supplier: String(data.get("supplier")).trim(),
          items: saleItems.map((item) => ({
            productCode: item.productCode,
            productName: item.productName,
            quantity: item.quantity,
            unitCost: item.unitPrice,
            subtotal: item.subtotal,
          })),
          total: saleTotal,
        };
        await addPurchase(purchase);
      }
      if (type === "prestamo") {
        const loan: Loan = {
          id: `l${Date.now()}`,
          reference: `PRE-${String(Date.now()).slice(-5)}`,
          clientId: String(data.get("client")),
          principal: loanAmount,
          interestRate,
          total: loanTotal,
          date: saleDate,
          frequency,
          skipSaturday,
          skipSunday,
          installments: loanPreview,
        };
        await addLoan(loan);
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la información.");
    }
  };
  const copy = {
    cliente: [
      editingClient ? "Editar cliente" : "Registrar cliente",
      "Completa los datos obligatorios de identificación.",
    ],
    venta: ["Nueva venta financiada", "Añade productos, ajusta precios y define el plan de pago."],
    prestamo: ["Nuevo préstamo", "Calcula un crédito directo y su calendario."],
    compra: [
      "Registrar compra de inventario",
      "Aumenta el stock y registra el gasto por productos adquiridos.",
    ],
    producto: [
      editingProduct ? "Editar producto" : "Crear producto",
      editingProduct
        ? "Actualiza la información y existencias del producto."
        : "Añade un electrodoméstico al inventario.",
    ],
  } as const;
  if (!type) return null;
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{copy[type][0]}</DialogTitle>
            <DialogDescription>{copy[type][1]}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="mt-2 space-y-4">
            {type === "compra" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="purchaseInvoice"
                    label="N° de Factura"
                    maxLength={50}
                    placeholder="FAC-0001"
                  />
                  <Field
                    name="supplier"
                    label="Proveedor"
                    maxLength={100}
                    placeholder="Distribuidora Electrónica C.A."
                  />
                </div>
                <DateControl value={saleDate} setValue={setSaleDate} label="Fecha de compra" />
                <div className="rounded-2xl border border-border p-4">
                  <Label htmlFor="product-picker-buy">Productos comprados *</Label>
                  <div className="mt-2 flex gap-2">
                    <select
                      id="product-picker-buy"
                      value={productToAdd}
                      onChange={(event) => setProductToAdd(event.target.value)}
                      className="form-control"
                    >
                      <option value="">Selecciona un producto</option>
                      {products.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.name} · {item.code}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      onClick={addSelectedProduct}
                      disabled={!productToAdd}
                      className="shrink-0 rounded-xl"
                    >
                      <Plus /> Añadir
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setQuickProductError("");
                      setQuickProductOpen(true);
                    }}
                    className="mt-1 h-auto px-0 text-primary"
                  >
                    <Plus /> Agregar nuevo producto
                  </Button>
                  <div className="mt-4 space-y-3">
                    {saleItems.map((line) => (
                      <div
                        key={line.productCode}
                        className="grid gap-3 rounded-xl bg-muted p-3 sm:grid-cols-[minmax(0,1fr)_110px_140px_44px] sm:items-end"
                      >
                        <div>
                          <p className="font-semibold">{line.productName}</p>
                          <p className="text-xs text-muted-foreground">{line.productCode}</p>
                        </div>
                        <NumberControl
                          label="Cantidad"
                          value={line.quantity}
                          setValue={(value) =>
                            updateSaleItem(line.productCode, {
                              quantity: typeof value === "number" ? value : 1,
                            })
                          }
                          min={1}
                          integer
                        />
                        <NumberControl
                          label="Costo unitario ($)"
                          value={line.unitPrice}
                          setValue={(value) =>
                            updateSaleItem(line.productCode, {
                              unitPrice: typeof value === "number" ? value : 0,
                            })
                          }
                          min={0.01}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setSaleItems((current) =>
                              current.filter((item) => item.productCode !== line.productCode),
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <ReadValue label="Total compra" value={money(saleTotal)} />
              </>
            )}
            {type === "cliente" && (
              <>
                <Field
                  name="clientCode"
                  label="ID CLIENTE"
                  defaultValue={editingClient?.clientCode}
                  maxLength={30}
                  placeholder="CLI-004"
                />
                <Field
                  name="name"
                  label="Nombre completo"
                  defaultValue={editingClient?.name}
                  maxLength={100}
                  placeholder="María Fernández"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="phone"
                    label="Teléfono"
                    defaultValue={editingClient?.phone}
                    maxLength={30}
                    placeholder="0414 555 0000"
                  />
                  <Field
                    name="document"
                    label="Cédula / DNI"
                    defaultValue={editingClient?.document}
                    maxLength={30}
                    placeholder="V-18.000.000"
                  />
                </div>
                <Field
                  name="address"
                  label="Dirección"
                  defaultValue={editingClient?.address}
                  maxLength={180}
                  placeholder="Calle, sector, referencia"
                />
              </>
            )}
            {type === "producto" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="code"
                    label="Código"
                    defaultValue={editingProduct?.code}
                    disabled={Boolean(editingProduct)}
                    maxLength={30}
                    placeholder="NV-241"
                  />
                  <Field
                    name="category"
                    label="Categoría"
                    defaultValue={editingProduct?.category}
                    maxLength={50}
                    placeholder="Neveras"
                  />
                </div>
                <Field
                  name="name"
                  label="Electrodoméstico"
                  defaultValue={editingProduct?.name}
                  maxLength={100}
                  placeholder="Nevera Samsung 16 pies"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="brand"
                    label="Marca"
                    defaultValue={editingProduct?.brand}
                    maxLength={60}
                    placeholder="Samsung"
                  />
                  <Field
                    name="capacity"
                    label="Capacidad"
                    defaultValue={editingProduct?.capacity}
                    maxLength={60}
                    placeholder="16 pies"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="price"
                    label="Precio ($)"
                    defaultValue={editingProduct?.price}
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="760"
                  />
                  <Field
                    name="stock"
                    label="Stock / cantidad"
                    defaultValue={editingProduct?.stock}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    placeholder="5"
                  />
                </div>
              </>
            )}
            {type === "venta" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="sale-client">Cliente *</Label>
                    <select
                      id="sale-client"
                      name="client"
                      required
                      value={selectedSaleClientId}
                      onChange={(event) => setSelectedSaleClientId(event.target.value)}
                      className="form-control mt-2"
                    >
                      <option value="">Selecciona</option>
                      {saleClients.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.clientCode} · {item.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => {
                        setQuickClientError("");
                        setQuickClientOpen(true);
                      }}
                      className="mt-1 h-auto px-0 text-primary"
                    >
                      <UserPlus /> Agregar nuevo cliente
                    </Button>
                  </div>
                  <Field
                    name="invoice"
                    label="N° / Nombre de factura"
                    maxLength={50}
                    placeholder="VEN-0012"
                  />
                </div>
                <div className="rounded-2xl border border-border p-4">
                  <Label htmlFor="product-picker">Productos *</Label>
                  <div className="mt-2 flex gap-2">
                    <select
                      id="product-picker"
                      value={productToAdd}
                      onChange={(event) => setProductToAdd(event.target.value)}
                      className="form-control"
                    >
                      <option value="">Selecciona un producto</option>
                      {products.map((item) => (
                        <option
                          key={item.code}
                          value={item.code}
                          disabled={
                            item.stock < 1 ||
                            saleItems.some((line) => line.productCode === item.code)
                          }
                        >
                          {item.name} · {money(item.price)} · Stock {item.stock}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      onClick={addSelectedProduct}
                      disabled={!productToAdd}
                      className="shrink-0 rounded-xl"
                    >
                      <Plus /> Añadir
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {saleItems.map((line) => {
                      const available =
                        products.find((item) => item.code === line.productCode)?.stock ?? 0;
                      return (
                        <div
                          key={line.productCode}
                          className="grid gap-3 rounded-xl bg-muted p-3 sm:grid-cols-[minmax(0,1fr)_110px_140px_44px] sm:items-end"
                        >
                          <div>
                            <p className="font-semibold">{line.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              {line.productCode} · Disponible: {available}
                            </p>
                          </div>
                          <NumberControl
                            label="Cantidad"
                            value={line.quantity}
                            setValue={(value) =>
                              updateSaleItem(line.productCode, {
                                quantity:
                                  typeof value === "number" ? Math.min(value, available) : 1,
                              })
                            }
                            min={1}
                            max={available}
                            integer
                          />
                          <NumberControl
                            label="Precio unitario ($)"
                            value={line.unitPrice}
                            setValue={(value) =>
                              updateSaleItem(line.productCode, {
                                unitPrice: typeof value === "number" ? value : 0,
                              })
                            }
                            min={0.01}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Quitar ${line.productName}`}
                            title="Quitar producto"
                            onClick={() =>
                              setSaleItems((current) =>
                                current.filter((item) => item.productCode !== line.productCode),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      );
                    })}
                    {!saleItems.length && (
                      <p className="text-sm text-muted-foreground">Aún no has añadido productos.</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <ReadValue label="Total productos" value={money(saleTotal)} />
                  <NumberControl
                    label="Inicial ($)"
                    value={downPayment}
                    setValue={(value) => setDownPayment(typeof value === "number" ? value : 0)}
                    min={0}
                    max={saleTotal}
                  />
                  <ReadValue label="Financiado" value={money(financed)} />
                </div>
                <FrequencyControl
                  value={frequency}
                  onChange={setFrequency}
                  options={["Semanal", "Quincenal", "Mensual"]}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberControl
                    label="Número de cuotas"
                    value={installments}
                    setValue={setInstallments}
                    min={3}
                    max={15}
                    integer
                  />
                  <DateControl value={saleDate} setValue={setSaleDate} label="Fecha de venta" />
                </div>
                <SchedulePreview schedule={salePreview} frequency={frequency} />
              </>
            )}
            {type === "prestamo" && (
              <>
                <NativeSelect
                  name="client"
                  label="Cliente *"
                  options={clients.map((item) => [item.id, `${item.clientCode} · ${item.name}`])}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberControl
                    label="Monto del préstamo *"
                    value={loanAmount}
                    setValue={(value) => setLoanAmount(typeof value === "number" ? value : 0)}
                    min={1}
                  />
                  <NumberControl
                    label="Tasa de interés (%) *"
                    value={interestRate}
                    setValue={(value) => setInterestRate(typeof value === "number" ? value : 0)}
                    min={0}
                    max={100}
                  />
                  <NumberControl
                    label="Número de cuotas *"
                    value={installments}
                    setValue={setInstallments}
                    min={1}
                    max={120}
                    integer
                  />
                </div>
                <FrequencyControl
                  value={frequency}
                  onChange={setFrequency}
                  options={["Diario", "Semanal", "Quincenal", "Mensual"]}
                />
                <DateControl value={saleDate} setValue={setSaleDate} label="Fecha de inicio" />
                <div className="rounded-2xl border border-border bg-muted/50 p-4">
                  <p className="font-bold">Excluir días no laborables</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Toggle
                      label="Omitir sábados"
                      checked={skipSaturday}
                      onChange={setSkipSaturday}
                    />
                    <Toggle label="Omitir domingos" checked={skipSunday} onChange={setSkipSunday} />
                  </div>
                </div>
                <div className="rounded-xl bg-secondary p-3 text-sm">
                  <span className="text-muted-foreground">Total con interés: </span>
                  <strong>{money(loanTotal)}</strong>
                </div>
                <SchedulePreview schedule={loanPreview} frequency={frequency} />
              </>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
              >
                {error}
              </p>
            )}
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl">
                {type === "compra" ? "Registrar compra" : "Guardar y generar ficha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={quickProductOpen} onOpenChange={setQuickProductOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar nuevo producto</DialogTitle>
            <DialogDescription>
              Se guardará en Inventario y se añadirá a esta compra con stock inicial cero.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createQuickProduct} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="quickCode" label="Código" maxLength={30} placeholder="NV-241" />
              <Field name="quickCategory" label="Categoría" maxLength={50} placeholder="Neveras" />
            </div>
            <Field
              name="quickName"
              label="Nombre del producto"
              maxLength={100}
              placeholder="Nevera Samsung 16 pies"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="quickBrand" label="Marca" maxLength={60} placeholder="Samsung" />
              <Field
                name="quickCapacity"
                label="Capacidad"
                maxLength={60}
                placeholder="16 pies"
                required={false}
              />
            </div>
            <Field
              name="quickPrice"
              label="Precio base de venta ($)"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="760"
            />
            {quickProductError && (
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
              >
                {quickProductError}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setQuickProductOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar y añadir</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={quickClientOpen} onOpenChange={setQuickClientOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar nuevo cliente</DialogTitle>
            <DialogDescription>
              Se guardará en Clientes y quedará seleccionado en esta venta.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createQuickClient} className="space-y-4">
            <Field name="quickClientCode" label="ID CLIENTE" maxLength={30} placeholder="CLI-004" />
            <Field
              name="quickClientName"
              label="Nombre completo"
              maxLength={100}
              placeholder="María Fernández"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="quickClientPhone"
                label="Teléfono"
                maxLength={30}
                placeholder="0414 555 0000"
              />
              <Field
                name="quickClientDocument"
                label="Cédula / DNI"
                maxLength={30}
                placeholder="V-18.000.000"
              />
            </div>
            <Field
              name="quickClientAddress"
              label="Dirección"
              maxLength={180}
              placeholder="Calle, sector, referencia"
            />
            {quickClientError && (
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
              >
                {quickClientError}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setQuickClientOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar y seleccionar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Field({
  name,
  label,
  ...props
}: React.ComponentProps<typeof Input> & { name: string; label: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required className="mt-2 h-11 rounded-xl" {...props} />
    </div>
  );
}
function NativeSelect({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: [string, string][];
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} required className="form-control mt-2">
        <option value="">Selecciona</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
function NumberControl({
  label,
  value,
  setValue,
  min,
  max,
  integer = false,
}: {
  label: string;
  value: number | "";
  setValue: (value: number | "") => void;
  min: number;
  max?: number;
  integer?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        required
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        min={min}
        max={max}
        step={integer ? 1 : 0.01}
        value={value}
        onChange={(event) => {
          const raw = event.target.value;
          setValue(raw === "" ? "" : integer ? Number.parseInt(raw, 10) : Number(raw));
        }}
        className="mt-2 h-11 rounded-xl"
      />
    </div>
  );
}
function DateControl({
  value,
  setValue,
  label,
}: {
  value: string;
  setValue: (value: string) => void;
  label: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        required
        type="date"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-2 h-11 rounded-xl"
      />
    </div>
  );
}
function ReadValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
function FrequencyControl({
  value,
  onChange,
  options,
}: {
  value: Frequency;
  onChange: (value: Frequency) => void;
  options: Frequency[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Frecuencia de pago *</legend>
      <div
        className={cn(
          "mt-2 grid gap-2",
          options.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
        )}
      >
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            variant={value === option ? "default" : "outline"}
            onClick={() => onChange(option)}
            className="rounded-xl px-2"
          >
            {option}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "justify-between rounded-xl",
        checked && "border-primary bg-secondary text-primary",
      )}
    >
      {label}
      <span
        className={cn(
          "h-5 w-9 rounded-full p-0.5 transition",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "block h-4 w-4 rounded-full bg-card transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </Button>
  );
}
function SchedulePreview({
  schedule,
  frequency,
}: {
  schedule: Installment[];
  frequency: Frequency;
}) {
  if (!schedule.length) return null;
  return (
    <div className="rounded-2xl bg-muted p-4">
      <div className="flex justify-between">
        <p className="font-bold">Plan de pagos</p>
        <span className="text-xs text-muted-foreground">
          {schedule.length} cuotas · {frequency}
        </span>
      </div>
      <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
        {schedule.map((item) => (
          <div
            key={item.number}
            className="flex items-center justify-between rounded-xl bg-card p-3 text-xs"
          >
            <span>
              Cuota {item.number} · {displayDate(item.due)}
            </span>
            <strong>{money(item.amount)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintSheet({
  printable,
  clients,
  onClose,
}: {
  printable: Printable;
  clients: Client[];
  onClose: () => void;
}) {
  if (!printable) return null;
  const { item } = printable;
  const client = clients.find((entry) => entry.id === item.clientId);
  const isSale = printable.kind === "sale";
  const sale = isSale ? printable.item : null;
  const loan = !isSale ? printable.item : null;
  const recordId = isSale ? sale?.invoice : loan?.reference;
  const productLines = sale?.items?.length
    ? sale.items
    : sale
      ? [
          {
            productCode: sale.productCode,
            productName: sale.productName,
            brand: sale.brand,
            capacity: sale.capacity,
            quantity: 1,
            unitPrice: sale.total,
            subtotal: sale.total,
          },
        ]
      : [];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="print-dialog max-h-[95vh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl sm:max-w-4xl">
        <DialogHeader className="print:hidden">
          <DialogTitle>Ficha de {isSale ? "venta" : "préstamo"}</DialogTitle>
          <DialogDescription>
            Revisa los datos antes de imprimir o guardar como PDF.
          </DialogDescription>
        </DialogHeader>
        <div id="print-sheet" className="print-sheet bg-card text-foreground">
          <div className="sheet-title">
            <span className="sheet-record">#{recordId}</span>
            <span className="sheet-brand">CREDI HOGAR</span>
            <span className="sheet-city">TUMEREMO</span>
          </div>
          <div className="sheet-grid">
            <SheetRow full label="NOMBRE" value={client?.name ?? ""} />
            {isSale ? (
              productLines.map((line, index) => (
                <div key={line.productCode}>
                  <SheetRow
                    full
                    label={productLines.length > 1 ? `PRODUCTO ${index + 1}` : "PRODUCTO"}
                    value={`${line.quantity} × ${line.productName} · ${money(line.unitPrice)}`}
                  />
                  <SheetPair
                    leftLabel="MARCA"
                    leftValue={line.brand}
                    rightLabel="CAPACIDAD"
                    rightValue={line.capacity}
                  />
                </div>
              ))
            ) : (
              <SheetRow full label="PRODUCTO" value="PRÉSTAMO EN EFECTIVO" />
            )}
            {isSale ? (
              <>
                <SheetPair
                  leftLabel="TOTAL COSTO"
                  leftValue={money(sale?.total ?? 0)}
                  rightLabel="INICIAL"
                  rightValue={money(sale?.downPayment ?? 0)}
                />
                <SheetPair
                  leftLabel="FINANCIADO"
                  leftValue={money(sale?.financed ?? 0)}
                  rightLabel="CUOTAS"
                  rightValue={String(item.installments.length)}
                />
                <SheetPair
                  leftLabel="MONTO CUOTAS"
                  leftValue={money(item.installments[0]?.amount ?? 0)}
                  rightLabel="FECHA INICIO"
                  rightValue={displayDate(item.date)}
                />
                <SheetPair
                  leftLabel="MODALIDAD"
                  leftValue={sale?.frequency ?? ""}
                  rightLabel="DÍA DE PAGO"
                  rightValue={displayDate(item.installments[0]?.due ?? item.date)}
                />
              </>
            ) : (
              <>
                <SheetPair
                  leftLabel="MONTO PRESTADO"
                  leftValue={money(loan?.principal ?? 0)}
                  rightLabel="INTERÉS"
                  rightValue={`${loan?.interestRate ?? 0}%`}
                />
                <SheetPair
                  leftLabel="TOTAL A PAGAR"
                  leftValue={money(loan?.total ?? 0)}
                  rightLabel="CUOTAS"
                  rightValue={String(item.installments.length)}
                />
                <SheetPair
                  leftLabel="MONTO CUOTAS"
                  leftValue={money(item.installments[0]?.amount ?? 0)}
                  rightLabel="FECHA INICIO"
                  rightValue={displayDate(item.date)}
                />
                <SheetPair
                  leftLabel="MODALIDAD"
                  leftValue={loan?.frequency ?? ""}
                  rightLabel="DÍAS OMITIDOS"
                  rightValue={
                    [loan?.skipSaturday ? "Sáb" : "", loan?.skipSunday ? "Dom" : ""]
                      .filter(Boolean)
                      .join(" / ") || "Ninguno"
                  }
                />
              </>
            )}
          </div>
          <table className="sheet-table">
            <thead>
              <tr>
                <th>CUOTAS</th>
                <th>FECHA</th>
                <th>MONTO</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {item.installments.map((payment) => (
                <tr key={payment.number}>
                  <td>{payment.number}</td>
                  <td>{displayDate(payment.due)}</td>
                  <td>{money(payment.amount)}</td>
                  <td>
                    {payment.paid
                      ? "Pagado"
                      : (payment.paidAmount ?? 0) > 0
                        ? `Abono ${money(payment.paidAmount ?? 0)}`
                        : "Pendiente"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className="sheet-footer">
            <MessageCircle aria-hidden="true" />
            <strong>0414-8594194</strong>
          </footer>
        </div>
        <DialogFooter className="gap-2 print:hidden">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Imprimir / Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function SheetRow({ label, value }: { full?: boolean; label: string; value: string }) {
  return (
    <div className="sheet-row">
      <strong>{label}:</strong>
      <span>{value}</span>
    </div>
  );
}
function SheetPair({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
}) {
  return (
    <div className="sheet-pair">
      <SheetRow label={leftLabel} value={leftValue} />
      <SheetRow label={rightLabel} value={rightValue} />
    </div>
  );
}
