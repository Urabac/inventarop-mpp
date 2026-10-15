import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  Package, 
  CreditCard, 
  ArrowUpRight, 
  LayoutDashboard,
  LogOut,
  Edit,
  Trash2,
  Plus,
  X,
  DollarSign,
  Search,
  Printer,
  AlertTriangle,
  RefreshCw,
  Lock,
  Mail,
  ShieldCheck,
  RotateCcw,
  Clock,
  Coins
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- CONFIGURACIÓN DE FIREBASE ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDXvWnkdShjz__lIZKIZY2qaEhRrcp_gCo",
  authDomain: "atelier-536a6.firebaseapp.com",
  projectId: "atelier-536a6",
  storageBucket: "atelier-536a6.firebasestorage.app",
  messagingSenderId: "27237769110",
  appId: "1:27237769110:web:fd91605d39e3fb2e5547b7",
  measurementId: "G-MLL1DCD2ZE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const COLLECTION_INVENTARIO = "motopartes_pirueta_inventario";
const COLLECTION_VENTAS = "motopartes_pirueta_ventas";
const COLLECTION_DEVOLUCIONES = "motopartes_pirueta_devoluciones";
const COLLECTION_CONFIG = "motopartes_pirueta_configuracion";

// --- CONSTANTES Y UTILIDADES ---
const METODOS_PAGO = ["Efectivo", "Divisas", "Pago movil", "Transferencia"];
const TOLERANCIA = 0.01; // margen de redondeo en dólares

const necesitaReferencia = (metodo: string) => metodo === "Pago movil" || metodo === "Transferencia";
const fmtBs = (n: number) => (n || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const escapeHtml = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// Resumen de métodos usados: "Efectivo + Pago movil"
const resumenMetodos = (pagos: any[]) => Array.from(new Set(pagos.map((p) => p.metodo))).join(" + ");
const resumenReferencias = (pagos: any[]) => pagos.map((p) => p.referencia).filter(Boolean).join(", ");

// Devuelve los pagos de una venta. Las ventas antiguas (sin "pagos") se convierten al nuevo formato.
const obtenerPagosVenta = (sale: any): any[] => {
  if (Array.isArray(sale.pagos)) return sale.pagos;
  const m = sale.metodoPago;
  return [{
    fecha: sale.fecha,
    tipo: "venta",
    metodo: m,
    monto: m === "Divisas" ? sale.totalDolares : sale.totalBs,
    montoDolares: sale.totalDolares,
    referencia: sale.referencia || ""
  }];
};

const sumaDolares = (pagos: any[]) => pagos.reduce((acc, p) => acc + (p.montoDolares || 0), 0);

// --- FORMULARIO REUTILIZABLE DE MÚLTIPLES MÉTODOS DE PAGO ---
function useFormularioPagos() {
  const [metodos, setMetodos] = useState<string[]>(["Efectivo"]);
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});

  const toggleMetodo = (m: string) => {
    if (metodos.includes(m)) {
      if (metodos.length === 1) return; // siempre debe haber al menos uno
      setMetodos(metodos.filter((x) => x !== m));
      setMontos((p) => { const n = { ...p }; delete n[m]; return n; });
      setRefs((p) => { const n = { ...p }; delete n[m]; return n; });
    } else {
      setMetodos([...metodos, m]);
    }
  };
  const setMonto = (m: string, v: string) => setMontos((p) => ({ ...p, [m]: v }));
  const setRef = (m: string, v: string) => setRefs((p) => ({ ...p, [m]: v.replace(/\D/g, "").slice(0, 4) }));
  const reset = () => { setMetodos(["Efectivo"]); setMontos({}); setRefs({}); };

  return { metodos, montos, refs, toggleMetodo, setMonto, setRef, reset };
}
type FormPagos = ReturnType<typeof useFormularioPagos>;

function SelectorPagos({
  form,
  auto,
  objetivoDolares,
  objetivoBs,
  ocultarDivisa = false
}: {
  form: FormPagos;
  auto: boolean;
  objetivoDolares: number;
  objetivoBs: number;
  ocultarDivisa?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-600 uppercase">
          Método de pago <span className="normal-case font-medium text-gray-400">(puedes elegir varios)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {METODOS_PAGO.map((metodo) => (
            <button
              key={metodo}
              type="button"
              onClick={() => form.toggleMetodo(metodo)}
              className={cn(
                "py-2 px-3 text-xs font-bold rounded-xl border transition text-center cursor-pointer",
                form.metodos.includes(metodo) ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              )}
            >
              {metodo}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {form.metodos.map((m) => (
          <div key={m} className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-gray-700">{m} {m === "Divisas" ? "($)" : "(BS)"}</span>
              {auto ? (
                <span className="text-sm font-black text-gray-900">
                  {m === "Divisas" ? `$${objetivoDolares.toFixed(2)}` : `${fmtBs(objetivoBs)} BS`}
                </span>
              ) : ocultarDivisa && m === "Divisas" ? (
                <span className="text-xs text-gray-400">Se calcula con el monto recibido</span>
              ) : (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.montos[m] ?? ""}
                  onChange={(e) => form.setMonto(m, e.target.value)}
                  placeholder="0.00"
                  className="w-36 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold text-right bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>
            {necesitaReferencia(m) && (
              <input
                type="text"
                maxLength={4}
                value={form.refs[m] ?? ""}
                onChange={(e) => form.setRef(m, e.target.value)}
                placeholder="Referencia: últimos 4 dígitos (Ej: 4829)"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>
        ))}
      </div>

      {form.metodos.length > 1 && (
        <p className="text-[11px] text-gray-500">
          Anota cuánto paga con cada método. Efectivo, Pago móvil y Transferencia se anotan en BS; Divisas en $.
        </p>
      )}
    </div>
  );
}

export function FinancialDashboard(props: any) {
  const [user, setUser] = useState<any>(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [errorLogin, setErrorLogin] = useState("");

  const [currentSection, setCurrentSection] = useState("inicio");
  const [tasaBcv, setTasaBcv] = useState<number>(877.90);
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [tempTasa, setTempTasa] = useState(tasaBcv.toString());
  const [cargandoBcv, setCargandoBcv] = useState(false);

  // Tasa DIVISA (manual)
  const [tasaDivisa, setTasaDivisa] = useState<number>(0);
  const [editandoDivisa, setEditandoDivisa] = useState(false);
  const [tempDivisa, setTempDivisa] = useState("0");

  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [devoluciones, setDevoluciones] = useState<any[]>([]);

  const [busquedaInventario, setBusquedaInventario] = useState("");
  const [modalStockBajoOpen, setModalStockBajoOpen] = useState(false);

  // Estados para Devoluciones
  const [busquedaVentaDev, setBusquedaVentaDev] = useState("");
  const [modalDevolucionOpen, setModalDevolucionOpen] = useState(false);
  const [ventaSeleccionadaDev, setVentaSeleccionadaDev] = useState<any>(null);
  const [tipoDevolucion, setTipoDevolucion] = useState<"devolucion" | "cambio">("devolucion");
  const [productoDevueltoItem, setProductoDevueltoItem] = useState<any>(null);
  const [productoCambioSeleccionado, setProductoCambioSeleccionado] = useState<any>(null);
  const [montoReembolso, setMontoReembolso] = useState("");
  const [comisionDevolucion, setComisionDevolucion] = useState("");

  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formCodigo, setFormCodigo] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formCantidad, setFormCantidad] = useState("");
  const [formPCompra, setFormPCompra] = useState("");

  // Estados de Nueva Venta
  const [modalVentaOpen, setModalVentaOpen] = useState(false);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const pagoVenta = useFormularioPagos();
  const [esPagoPendiente, setEsPagoPendiente] = useState(false);
  const [clienteNombre, setClienteNombre] = useState("");
  const [darVuelto, setDarVuelto] = useState(false);
  const [montoRecibido, setMontoRecibido] = useState("");
  const [filtroVentas, setFiltroVentas] = useState("dia");

  // Estados de Pagos Pendientes
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const [modoPendiente, setModoPendiente] = useState<"detalle" | "abonar" | "finalizar">("detalle");
  const [abonoMetodo, setAbonoMetodo] = useState("Efectivo");
  const [abonoMonto, setAbonoMonto] = useState("");
  const [abonoRef, setAbonoRef] = useState("");
  const pagoFinal = useFormularioPagos();
  const [guardandoPendiente, setGuardandoPendiente] = useState(false);

  // Cooldown States para evitar doble clic
  const [guardandoVenta, setGuardandoVenta] = useState(false);
  const [guardandoProductoState, setGuardandoProductoState] = useState(false);
  const [guardandoDevolucionState, setGuardandoDevolucionState] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCargandoAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const obtenerTasaBcvOficial = async () => {
    setCargandoBcv(true);
    try {
      const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
      if (res.ok) {
        const data = await res.json();
        const valorOficial = typeof data.promedio === "number" ? data.promedio : parseFloat(data.promedio);
        if (!isNaN(valorOficial) && valorOficial > 0) {
          setTasaBcv(valorOficial);
          setTempTasa(valorOficial.toString());
          await setDoc(doc(db, COLLECTION_CONFIG, "bcv"), { valor: valorOficial });
          setCargandoBcv(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Fallo primera fuente BCV, intentando respaldo...", e);
    }

    try {
      const resBackup = await fetch("https://pydolarve.org/api/v1/dollar?page=bcv");
      if (resBackup.ok) {
        const dataBackup = await resBackup.json();
        if (dataBackup && dataBackup.monedas && dataBackup.monedas.usd) {
          const valorUsd = parseFloat(dataBackup.monedas.usd.promedio);
          if (!isNaN(valorUsd) && valorUsd > 0) {
            setTasaBcv(valorUsd);
            setTempTasa(valorUsd.toString());
            await setDoc(doc(db, COLLECTION_CONFIG, "bcv"), { valor: valorUsd });
          }
        }
      }
    } catch (error) {
      console.warn("No se pudo obtener la tasa BCV automáticamente:", error);
    } finally {
      setCargandoBcv(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    obtenerTasaBcvOficial();

    const unsubProducts = onSnapshot(collection(db, COLLECTION_INVENTARIO), (snapshot) => {
      const listaProd = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(listaProd);
    });

    const unsubSales = onSnapshot(collection(db, COLLECTION_VENTAS), (snapshot) => {
      const listaVentas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      listaVentas.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setSales(listaVentas);
    });

    const unsubDev = onSnapshot(collection(db, COLLECTION_DEVOLUCIONES), (snapshot) => {
      const listaDev = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      listaDev.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setDevoluciones(listaDev);
    });

    const unsubTasa = onSnapshot(doc(db, COLLECTION_CONFIG, "bcv"), (docSnap) => {
      if (docSnap.exists()) {
        const val = docSnap.data().valor;
        setTasaBcv(val);
        setTempTasa(val.toString());
      }
    });

    const unsubDivisa = onSnapshot(doc(db, COLLECTION_CONFIG, "divisa"), (docSnap) => {
      if (docSnap.exists()) {
        const val = docSnap.data().valor;
        setTasaDivisa(val);
        setTempDivisa(val.toString());
      }
    });

    return () => {
      unsubProducts();
      unsubSales();
      unsubDev();
      unsubTasa();
      unsubDivisa();
    };
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLogin("");
    try {
      await signInWithEmailAndPassword(auth, emailInput, passwordInput);
    } catch (err: any) {
      console.error("Error de autenticación:", err);
      setErrorLogin("Correo o contraseña incorrectos.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (props.logout) props.logout();
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  const guardarTasa = async () => {
    const val = parseFloat(tempTasa);
    if (!isNaN(val) && val > 0) {
      setTasaBcv(val);
      setEditandoTasa(false);
      try {
        await setDoc(doc(db, COLLECTION_CONFIG, "bcv"), { valor: val });
      } catch (e) {
        console.error("Error guardando tasa en Firestore:", e);
      }
    }
  };

  const guardarTasaDivisa = async () => {
    const val = parseFloat(tempDivisa);
    if (!isNaN(val) && val > 0) {
      setTasaDivisa(val);
      setEditandoDivisa(false);
      try {
        await setDoc(doc(db, COLLECTION_CONFIG, "divisa"), { valor: val });
      } catch (e) {
        console.error("Error guardando tasa DIVISA en Firestore:", e);
      }
    }
  };

  const calcularPrecios = (pCompra: number) => {
    let pVenta = 0;
    if (pCompra <= 1) {
      pVenta = 1.5;
    } else if (pCompra <= 2) {
      pVenta = pCompra * 2;
    } else {
      pVenta = pCompra * 1.7;
    }
    const pFinalBs = pVenta * tasaBcv;
    return {
      pVenta: Number(pVenta.toFixed(2)),
      pFinalBs: Number(pFinalBs.toFixed(2))
    };
  };

  // Convierte un monto (en la moneda nativa del método) a dólares
  const tasaBcvSegura = tasaBcv > 0 ? tasaBcv : 1;
  const aDolares = (metodo: string, monto: number) => (metodo === "Divisas" ? monto : monto / tasaBcvSegura);

  // Arma la lista de pagos a partir de un formulario de métodos de pago
  const armarPagos = (
    form: { metodos: string[]; montos: Record<string, string>; refs: Record<string, string> },
    auto: boolean,
    objetivoDolares: number,
    objetivoBs: number,
    tipo: string,
    fecha: string,
    divisaFija: number | null = null
  ) => {
    const lista: any[] = [];
    form.metodos.forEach((m) => {
      let monto = 0;
      let montoDolares = 0;
      if (m === "Divisas" && divisaFija !== null) {
        monto = divisaFija;
        montoDolares = divisaFija;
      } else if (auto) {
        monto = m === "Divisas" ? objetivoDolares : objetivoBs;
        montoDolares = objetivoDolares;
      } else {
        monto = parseFloat(form.montos[m]) || 0;
        montoDolares = aDolares(m, monto);
      }
      if (monto > 0) {
        lista.push({
          fecha,
          tipo,
          metodo: m,
          monto: Number(monto.toFixed(2)),
          montoDolares: Number(montoDolares.toFixed(2)),
          referencia: necesitaReferencia(m) ? (form.refs[m] || "") : ""
        });
      }
    });
    return lista;
  };

  const abrirModalNuevo = () => {
    setEditandoId(null);
    setFormCodigo("");
    setFormNombre("");
    setFormCantidad("");
    setFormPCompra("");
    setModalProductoOpen(true);
  };

  const abrirModalEditar = (prod: any) => {
    setEditandoId(prod.id);
    setFormCodigo(prod.codigo);
    setFormNombre(prod.nombre);
    setFormCantidad(prod.cantidad.toString());
    setFormPCompra(prod.pCompra.toString());
    setModalProductoOpen(true);
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardandoProductoState) return;
    setGuardandoProductoState(true);

    const pCompraNum = parseFloat(formPCompra) || 0;
    const cantidadNum = parseInt(formCantidad) || 0;

    const datosProd = {
      codigo: formCodigo || `MP-${Math.floor(Math.random() * 900 + 100)}`,
      nombre: formNombre || "Sin nombre",
      cantidad: cantidadNum,
      pCompra: pCompraNum
    };

    try {
      if (editandoId) {
        await updateDoc(doc(db, COLLECTION_INVENTARIO, editandoId), datosProd);
      } else {
        await addDoc(collection(db, COLLECTION_INVENTARIO), datosProd);
      }
      setModalProductoOpen(false);
    } catch (error: any) {
      console.error("Error al guardar en Firebase:", error);
    } finally {
      setTimeout(() => setGuardandoProductoState(false), 2000);
    }
  };

  const eliminarProducto = async (id: string) => {
    try {
      await deleteDoc(doc(db, COLLECTION_INVENTARIO, id));
    } catch (e: any) {
      console.error("Error eliminando:", e);
    }
  };

  const agregarAlCarrito = (prod: any) => {
    const productoInventario = products.find(p => p.id === prod.id);
    const stockDisponible = productoInventario ? productoInventario.cantidad : 0;

    const calc = calcularPrecios(prod.pCompra);
    const itemExistente = carrito.find(item => item.id === prod.id);
    const cantidadActualEnCarrito = itemExistente ? itemExistente.qty : 0;

    if (cantidadActualEnCarrito + 1 > stockDisponible) return;

    if (itemExistente) {
      setCarrito(carrito.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCarrito([...carrito, { ...prod, pVenta: calc.pVenta, pFinalBs: calc.pFinalBs, qty: 1 }]);
    }
  };

  const cambiarCantidadCarrito = (id: string, delta: number) => {
    const productoInventario = products.find(p => p.id === id);
    const stockDisponible = productoInventario ? productoInventario.cantidad : 0;

    setCarrito(carrito.map(item => {
      if (item.id === id) {
        const nuevaQty = item.qty + delta;
        if (delta > 0 && nuevaQty > stockDisponible) return item;
        return nuevaQty > 0 ? { ...item, qty: nuevaQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const totalVentaDolares = carrito.reduce((sum, item) => sum + (item.pVenta * item.qty), 0);
  const totalVentaBs = carrito.reduce((sum, item) => sum + (item.pFinalBs * item.qty), 0);

  // --- CÁLCULOS DE PAGO DE LA NUEVA VENTA ---
  const autoCompleto = pagoVenta.metodos.length === 1 && !esPagoPendiente;
  const vueltoDisponible = pagoVenta.metodos.includes("Divisas") && !esPagoPendiente;
  const vueltoActivo = darVuelto && vueltoDisponible;

  // Lo que se paga con métodos distintos a Divisas (para saber cuánto debe cubrir la divisa)
  const pagosOtros = armarPagos(
    { ...pagoVenta, metodos: pagoVenta.metodos.filter((m) => m !== "Divisas") },
    autoCompleto, totalVentaDolares, totalVentaBs, "venta", ""
  );
  const restanteDivisa = vueltoActivo ? Math.max(0, totalVentaDolares - sumaDolares(pagosOtros)) : 0;
  const recibidoNum = parseFloat(montoRecibido) || 0;
  const vueltoDolares = vueltoActivo ? Math.max(0, recibidoNum - restanteDivisa) : 0;
  const vueltoBsBcv = vueltoDolares * tasaBcv;
  const vueltoBsDivisa = vueltoDolares * tasaDivisa;

  const pagosVentaPreview = armarPagos(
    pagoVenta, autoCompleto, totalVentaDolares, totalVentaBs, "venta", "", vueltoActivo ? restanteDivisa : null
  );
  const pagadoVentaDolares = sumaDolares(pagosVentaPreview);
  const pendienteVentaDolares = Math.max(0, totalVentaDolares - pagadoVentaDolares);

  const validarVenta = (): string | null => {
    if (carrito.length === 0) return "Agrega al menos un producto.";
    if (pagosVentaPreview.some((p) => necesitaReferencia(p.metodo) && p.referencia.length !== 4)) {
      return "Ingresa los 4 últimos dígitos de la referencia.";
    }
    if (esPagoPendiente) {
      if (!clienteNombre.trim()) return "Escribe el nombre del cliente.";
      if (totalVentaDolares - pagadoVentaDolares <= TOLERANCIA) return "En un pago pendiente, el monto pagado debe ser menor al total.";
      return null;
    }
    if (vueltoActivo && recibidoNum < restanteDivisa - TOLERANCIA) {
      return "El monto recibido en divisa es menor a lo que falta por pagar.";
    }
    if (pagadoVentaDolares < totalVentaDolares - TOLERANCIA) {
      return `Faltan $${(totalVentaDolares - pagadoVentaDolares).toFixed(2)} por cubrir.`;
    }
    return null;
  };
  const errorVenta = validarVenta();

  const confirmarVenta = async () => {
    if (guardandoVenta || validarVenta()) return;

    setGuardandoVenta(true);
    try {
      for (let item of carrito) {
        const prodActual = products.find(p => p.id === item.id);
        if (prodActual) {
          const nuevaCant = Math.max(0, prodActual.cantidad - item.qty);
          await updateDoc(doc(db, COLLECTION_INVENTARIO, item.id), { cantidad: nuevaCant });
        }
      }

      const fecha = new Date().toISOString();
      const pagos = armarPagos(
        pagoVenta, autoCompleto, totalVentaDolares, totalVentaBs, "venta", fecha, vueltoActivo ? restanteDivisa : null
      );
      const montoPendiente = esPagoPendiente
        ? Number(Math.max(0, totalVentaDolares - sumaDolares(pagos)).toFixed(2))
        : 0;

      const nuevaVenta = {
        fecha,
        items: [...carrito],
        totalDolares: totalVentaDolares,
        totalBs: totalVentaBs,
        metodoPago: resumenMetodos(pagos) || "Pendiente",
        referencia: resumenReferencias(pagos),
        pagos,
        pendiente: esPagoPendiente,
        cliente: esPagoPendiente ? clienteNombre.trim() : "",
        montoPendiente,
        vuelto: vueltoActivo && vueltoDolares > 0
          ? {
              recibido: Number(recibidoNum.toFixed(2)),
              dolares: Number(vueltoDolares.toFixed(2)),
              bsBcv: Number(vueltoBsBcv.toFixed(2)),
              bsDivisa: Number(vueltoBsDivisa.toFixed(2))
            }
          : null
      };

      await addDoc(collection(db, COLLECTION_VENTAS), nuevaVenta);

      setCarrito([]);
      pagoVenta.reset();
      setEsPagoPendiente(false);
      setClienteNombre("");
      setDarVuelto(false);
      setMontoRecibido("");
      setModalVentaOpen(false);
    } catch (e: any) {
      console.error("Error al procesar la venta en Firebase:", e);
    } finally {
      setTimeout(() => setGuardandoVenta(false), 2000);
    }
  };

  // --- PAGOS PENDIENTES ---
  const ventasPendientes = sales.filter((s: any) => s.pendiente);
  const totalPendienteDolares = ventasPendientes.reduce((acc: number, s: any) => acc + (s.montoPendiente || 0), 0);
  const ventaPendienteActual = sales.find((s: any) => s.id === pendienteId) || null;

  const abrirPendiente = (id: string) => {
    setPendienteId(id);
    setModoPendiente("detalle");
  };

  const cerrarPendiente = () => {
    setPendienteId(null);
    setModoPendiente("detalle");
    setAbonoMetodo("Efectivo");
    setAbonoMonto("");
    setAbonoRef("");
    pagoFinal.reset();
  };

  // Abono
  const abonoMontoNum = parseFloat(abonoMonto) || 0;
  const abonoDolares = aDolares(abonoMetodo, abonoMontoNum);
  const validarAbono = (): string | null => {
    if (!ventaPendienteActual) return "Venta no encontrada.";
    if (abonoMontoNum <= 0) return "Ingresa el monto del abono.";
    if (necesitaReferencia(abonoMetodo) && abonoRef.length !== 4) return "Ingresa los 4 últimos dígitos de la referencia.";
    if (abonoDolares > ventaPendienteActual.montoPendiente + TOLERANCIA) return "El abono no puede ser mayor a lo que debe.";
    return null;
  };
  const errorAbono = validarAbono();

  const procesarAbono = async () => {
    const venta = ventaPendienteActual;
    if (!venta || guardandoPendiente || validarAbono()) return;
    setGuardandoPendiente(true);
    try {
      const nuevoPago = {
        fecha: new Date().toISOString(),
        tipo: "abono",
        metodo: abonoMetodo,
        monto: Number(abonoMontoNum.toFixed(2)),
        montoDolares: Number(abonoDolares.toFixed(2)),
        referencia: necesitaReferencia(abonoMetodo) ? abonoRef : ""
      };
      const pagos = [...(venta.pagos || []), nuevoPago];
      const nuevoPendiente = Math.max(0, Number((venta.montoPendiente - abonoDolares).toFixed(2)));
      const completo = nuevoPendiente <= TOLERANCIA; // si el abono cubre todo, la venta queda completa

      await updateDoc(doc(db, COLLECTION_VENTAS, venta.id), {
        pagos,
        metodoPago: resumenMetodos(pagos),
        referencia: resumenReferencias(pagos),
        montoPendiente: completo ? 0 : nuevoPendiente,
        pendiente: !completo
      });

      setAbonoMonto("");
      setAbonoRef("");
      if (completo) cerrarPendiente();
      else setModoPendiente("detalle");
    } catch (e) {
      console.error("Error al registrar abono:", e);
    } finally {
      setGuardandoPendiente(false);
    }
  };

  // Pago finalizado
  const autoFinal = pagoFinal.metodos.length === 1;
  const debeDolares = ventaPendienteActual ? ventaPendienteActual.montoPendiente : 0;
  const debeBs = debeDolares * tasaBcvSegura;
  const pagosFinalPreview = ventaPendienteActual
    ? armarPagos(pagoFinal, autoFinal, debeDolares, debeBs, "final", "")
    : [];
  const validarFinal = (): string | null => {
    if (!ventaPendienteActual) return "Venta no encontrada.";
    if (pagosFinalPreview.some((p) => necesitaReferencia(p.metodo) && p.referencia.length !== 4)) {
      return "Ingresa los 4 últimos dígitos de la referencia.";
    }
    const pagado = sumaDolares(pagosFinalPreview);
    if (pagado < debeDolares - TOLERANCIA) return `Faltan $${(debeDolares - pagado).toFixed(2)} por cubrir.`;
    return null;
  };
  const errorFinal = validarFinal();

  const procesarPagoFinalizado = async () => {
    const venta = ventaPendienteActual;
    if (!venta || guardandoPendiente || validarFinal()) return;
    setGuardandoPendiente(true);
    try {
      const fecha = new Date().toISOString();
      const nuevos = armarPagos(pagoFinal, autoFinal, debeDolares, debeBs, "final", fecha);
      const pagos = [...(venta.pagos || []), ...nuevos];

      await updateDoc(doc(db, COLLECTION_VENTAS, venta.id), {
        pagos,
        metodoPago: resumenMetodos(pagos),
        referencia: resumenReferencias(pagos),
        pendiente: false,
        montoPendiente: 0,
        fechaFinalizado: fecha
      });
      cerrarPendiente();
    } catch (e) {
      console.error("Error al finalizar pago:", e);
    } finally {
      setGuardandoPendiente(false);
    }
  };

  const procesarDevolucionOCambio = async () => {
    if (!ventaSeleccionadaDev || !productoDevueltoItem || guardandoDevolucionState) return;
    setGuardandoDevolucionState(true);

    try {
      const prodInv = products.find(p => p.id === productoDevueltoItem.id);
      if (prodInv) {
        const nuevaCant = prodInv.cantidad + productoDevueltoItem.qty;
        await updateDoc(doc(db, COLLECTION_INVENTARIO, productoDevueltoItem.id), { cantidad: nuevaCant });
      }

      let detalleOperacion = "";

      if (tipoDevolucion === "devolucion") {
        if (ventaSeleccionadaDev.items.length === 1) {
          await deleteDoc(doc(db, COLLECTION_VENTAS, ventaSeleccionadaDev.id));
          detalleOperacion = "Devolución total (Venta eliminada)";
        } else {
          const nuevosItems = ventaSeleccionadaDev.items.filter((i: any) => i.id !== productoDevueltoItem.id);
          const nuevoTotalDolar = nuevosItems.reduce((acc: number, i: any) => acc + (i.pVenta * i.qty), 0);
          const nuevoTotalBs = nuevosItems.reduce((acc: number, i: any) => acc + (i.pFinalBs * i.qty), 0);

          await updateDoc(doc(db, COLLECTION_VENTAS, ventaSeleccionadaDev.id), {
            items: nuevosItems,
            totalDolares: nuevoTotalDolar,
            totalBs: nuevoTotalBs
          });
          detalleOperacion = "Devolución parcial de producto";
        }
      } else {
        if (!productoCambioSeleccionado) {
          setGuardandoDevolucionState(false);
          return;
        }

        const prodNuevoInv = products.find(p => p.id === productoCambioSeleccionado.id);
        if (!prodNuevoInv || prodNuevoInv.cantidad < 1) {
          setGuardandoDevolucionState(false);
          return;
        }
        await updateDoc(doc(db, COLLECTION_INVENTARIO, productoCambioSeleccionado.id), { 
          cantidad: prodNuevoInv.cantidad - 1 
        });

        const calcNuevo = calcularPrecios(productoCambioSeleccionado.pCompra);
        const itemNuevoObj = {
          ...productoCambioSeleccionado,
          pVenta: calcNuevo.pVenta,
          pFinalBs: calcNuevo.pFinalBs,
          qty: 1
        };

        const otrosItems = ventaSeleccionadaDev.items.filter((i: any) => i.id !== productoDevueltoItem.id);
        const itemsActualizados = [...otrosItems, itemNuevoObj];

        const nuevoTotalDolar = itemsActualizados.reduce((acc: number, i: any) => acc + (i.pVenta * i.qty), 0);
        const nuevoTotalBs = itemsActualizados.reduce((acc: number, i: any) => acc + (i.pFinalBs * i.qty), 0);

        await updateDoc(doc(db, COLLECTION_VENTAS, ventaSeleccionadaDev.id), {
          items: itemsActualizados,
          totalDolares: nuevoTotalDolar,
          totalBs: nuevoTotalBs
        });
        detalleOperacion = `Cambio de [${productoDevueltoItem.nombre}] por [${productoCambioSeleccionado.nombre}]`;
      }

      const registroDev = {
        fecha: new Date().toISOString(),
        ventaId: ventaSeleccionadaDev.id,
        tipo: tipoDevolucion,
        detalle: detalleOperacion,
        productoDevuelto: productoDevueltoItem.nombre,
        productoNuevo: productoCambioSeleccionado ? productoCambioSeleccionado.nombre : "N/A",
        montoReembolsoBs: parseFloat(montoReembolso) || 0,
        comision: comisionDevolucion || "Sin comisión"
      };

      await addDoc(collection(db, COLLECTION_DEVOLUCIONES), registroDev);

      setModalDevolucionOpen(false);
      setVentaSeleccionadaDev(null);
      setProductoDevueltoItem(null);
      setProductoCambioSeleccionado(null);
      setMontoReembolso("");
      setComisionDevolucion("");
    } catch (e: any) {
      console.error("Error al procesar devolución:", e);
    } finally {
      setTimeout(() => setGuardandoDevolucionState(false), 2000);
    }
  };

  const ventasFiltradas = sales.filter((sale: any) => {
    const fechaVenta = new Date(sale.fecha);
    const ahora = new Date();
    if (filtroVentas === "dia") {
      return fechaVenta.toDateString() === ahora.toDateString();
    } else if (filtroVentas === "semana") {
      const unaSemanaAtras = new Date();
      unaSemanaAtras.setDate(ahora.getDate() - 7);
      return fechaVenta >= unaSemanaAtras;
    } else if (filtroVentas === "mes") {
      return fechaVenta.getMonth() === ahora.getMonth() && fechaVenta.getFullYear() === ahora.getFullYear();
    }
    return true;
  });

  const productosFiltradosInventario = products
    .filter(p => 
      p.nombre.toLowerCase().includes(busquedaInventario.toLowerCase()) || 
      p.codigo.toLowerCase().includes(busquedaInventario.toLowerCase())
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const totalProductosRegistrados = products.length;
  const productosStockBajo = products
    .filter(p => Number(p.cantidad) <= 5)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  // --- REPORTE DE VENTAS CON DEVOLUCIONES RESTADAS ---
  const generarReportePDF = () => {
    const hoyStr = new Date().toDateString();
    const ventasDelDia = sales.filter((sale: any) => new Date(sale.fecha).toDateString() === hoyStr);
    const devDelDia = devoluciones.filter((dev: any) => new Date(dev.fecha).toDateString() === hoyStr);

    // Dinero realmente cobrado hoy (incluye abonos y pagos finalizados de ventas anteriores)
    const pagosDelDia = sales
      .flatMap((s: any) => obtenerPagosVenta(s))
      .filter((p: any) => new Date(p.fecha).toDateString() === hoyStr);

    let efectivoBs = 0;
    let divisaDolar = 0;
    let pagoMovilBs = 0;
    let transferenciaBs = 0;

    pagosDelDia.forEach((p: any) => {
      if (p.metodo === "Efectivo") efectivoBs += p.monto;
      else if (p.metodo === "Divisas") divisaDolar += p.monto;
      else if (p.metodo === "Pago movil") pagoMovilBs += p.monto;
      else if (p.metodo === "Transferencia") transferenciaBs += p.monto;
    });

    const totalCobradoDolar = sumaDolares(pagosDelDia);
    const totalPorCobrarDolar = ventasPendientes.reduce((acc: number, s: any) => acc + (s.montoPendiente || 0), 0);

    let totalDolarDia = ventasDelDia.reduce((acc, s) => acc + s.totalDolares, 0);
    let totalBsDia = ventasDelDia.reduce((acc, s) => acc + s.totalBs, 0);

    // Calcular total devuelto en el día
    let totalDevueltoBs = devDelDia.reduce((acc, d) => acc + (d.montoReembolsoBs || 0), 0);
    let totalDevueltoDolar = totalDevueltoBs / (tasaBcv > 0 ? tasaBcv : 1);

    // Restar devoluciones a los totales de ganancia del día
    totalDolarDia = Math.max(0, totalDolarDia - totalDevueltoDolar);
    totalBsDia = Math.max(0, totalBsDia - totalDevueltoBs);

    const ventanaReporte = window.open("", "_blank");
    if (!ventanaReporte) return;

    ventanaReporte.document.write(`
      <html>
        <head>
          <title>Reporte de Ventas - Moto Partes Pirueta</title>
          <style>
            body { font-family: Arial, sans-serif; color: #333; margin: 30px; }
            h2 { text-align: center; color: #047857; margin-bottom: 5px; }
            p.subtitle { text-align: center; font-size: 12px; color: #666; margin-top: 0; }
            .info { margin: 20px 0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; }
            td.num, th.num { text-align: right; }
            .totales-box { margin-top: 25px; border: 2px solid #047857; padding: 15px; border-radius: 8px; background-color: #f0fdf4; }
            .totales-box h3 { margin: 0 0 10px 0; color: #047857; font-size: 16px; border-bottom: 1px solid #bbf7d0; padding-bottom: 5px; }
            .totales-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; }
            .totales-grid div { display: flex; justify-content: space-between; padding: 4px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; }
            .total-final { margin-top: 15px; font-size: 16px; font-weight: bold; text-align: right; color: #0f172a; border-top: 1px dashed #047857; padding-top: 10px; }
            .print-btn { margin-top: 30px; text-align: center; }
            .print-btn button { background: #047857; color: white; border: none; padding: 10px 20px; font-size: 14px; border-radius: 6px; cursor: pointer; }
            .total-final p { margin: 4px 0; }
            .dev-box { margin-top: 25px; padding: 15px; border: 1px solid #f59e0b; background: #fffbeb; border-radius: 8px; }
            /* Evita que una fila o un cuadro de totales se parta entre dos páginas */
            tr, .totales-box, .dev-box { page-break-inside: avoid; break-inside: avoid; }
            thead { display: table-header-group; }
            @page { size: A4; margin: 10mm; }
            @media print {
              body { margin: 0; }
              h2 { margin-top: 0; }
              .info { margin: 12px 0; }
              table { margin-top: 12px; }
              th, td { padding: 6px 8px; }
              .dev-box, .totales-box { margin-top: 14px; padding: 10px; }
              .print-btn { display: none; }
            }
          </style>
        </head>
        <body>
          <h2>MOTO PARTES PIRUETA</h2>
          <p class="subtitle">Reporte Diario de Ventas (Neto con Devoluciones)</p>
          <div class="info">
            <strong>Fecha del reporte:</strong> ${new Date().toLocaleDateString()} <br>
            <strong>Tasa BCV aplicada:</strong> ${fmtBs(tasaBcv)} BS <br>
            <strong>Tasa DIVISA:</strong> ${fmtBs(tasaDivisa)} BS
          </div>
          <table>
            <thead>
              <tr>
                <th>ID / Hora</th>
                <th>Método de Pago</th>
                <th>Ref.</th>
                <th>Productos Vendidos</th>
                <th class="num">Total ($)</th>
                <th class="num">Total (BS)</th>
              </tr>
            </thead>
            <tbody>
              ${ventasDelDia.map(s => `
                <tr>
                  <td>${new Date(s.fecha).toLocaleTimeString()}</td>
                  <td>${escapeHtml(s.metodoPago)}${s.pendiente ? `<br><strong style="color:#b45309;">&#9888; Pendiente: ${escapeHtml(s.cliente)} (debe $${(s.montoPendiente || 0).toFixed(2)})</strong>` : ""}</td>
                  <td>${escapeHtml(s.referencia) || "N/A"}</td>
                  <td>${s.items.map((i: any) => `${i.qty}x ${escapeHtml(i.nombre)}`).join(", ")}</td>
                  <td class="num">$${s.totalDolares.toFixed(2)}</td>
                  <td class="num">${fmtBs(s.totalBs)} BS</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="dev-box">
            <h3 style="margin: 0 0 8px 0; color: #b45309; font-size: 15px;">Resumen de Devoluciones del Día</h3>
            <p style="margin: 4px 0; font-size: 13px;">Cantidad de devoluciones/cambios: <strong>${devDelDia.length}</strong></p>
            <p style="margin: 4px 0; font-size: 13px;">Monto total devuelto: <strong>$${totalDevueltoDolar.toFixed(2)} (${fmtBs(totalDevueltoBs)} BS)</strong></p>
          </div>

          <div class="totales-box">
            <h3>Dinero cobrado hoy por método</h3>
            <div class="totales-grid">
              <div><span>Efectivo (Bolívares):</span> <strong>${fmtBs(efectivoBs)} BS</strong></div>
              <div><span>Divisa (Dólares):</span> <strong>$${divisaDolar.toFixed(2)}</strong></div>
              <div><span>Pago Móvil (BS):</span> <strong>${fmtBs(pagoMovilBs)} BS</strong></div>
              <div><span>Transferencia (BS):</span> <strong>${fmtBs(transferenciaBs)} BS</strong></div>
            </div>
            <div class="total-final">
              <p>Total cobrado hoy ($ equivalente): $${totalCobradoDolar.toFixed(2)}</p>
              <p>Total Neto Vendido del Día ($): $${totalDolarDia.toFixed(2)}</p>
              <p>Total Neto Vendido del Día (BS): ${fmtBs(totalBsDia)} BS</p>
              <p style="color:#b45309;">Pendiente por cobrar (todos los clientes): $${totalPorCobrarDolar.toFixed(2)}</p>
            </div>
          </div>

          <div class="print-btn">
            <button onclick="window.print()">Imprimir / Guardar como PDF</button>
          </div>
        </body>
      </html>
    `);
    ventanaReporte.document.close();
  };

  if (cargandoAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-gray-100 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-2xl mb-2">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">Moto Partes Pirueta</h1>
            <p className="text-xs text-gray-500">Ingresa tus credenciales autorizadas de Firebase</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {errorLogin && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl text-center">
                {errorLogin}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input 
                  type="email" 
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@motopartes.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input 
                  type="password" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition cursor-pointer"
            >
              Iniciar Sesión en el Sistema
            </Button>
          </form>

          <p className="text-center text-[10px] text-gray-400">Sistema protegido con Firebase Authentication</p>
        </div>
      </div>
    );
  }

  const navClase = (seccion: string) =>
    cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer",
      currentSection === seccion ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100"
    );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              Sistema Nube
            </span>
            <h1 className="text-xl font-bold text-gray-900 mt-2">Moto Partes Pirueta</h1>
          </div>
          <nav className="p-4 space-y-1">
            <button onClick={() => setCurrentSection("inicio")} className={navClase("inicio")}>
              <LayoutDashboard className="w-5 h-5" />
              Inicio
            </button>
            <button onClick={() => setCurrentSection("ventas")} className={navClase("ventas")}>
              <CreditCard className="w-5 h-5" />
              Ventas
            </button>
            <button onClick={() => setCurrentSection("pendientes")} className={navClase("pendientes")}>
              <Clock className="w-5 h-5" />
              Pagos pendientes
              {ventasPendientes.length > 0 && (
                <span className="ml-auto text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {ventasPendientes.length}
                </span>
              )}
            </button>
            <button onClick={() => setCurrentSection("devoluciones")} className={navClase("devoluciones")}>
              <RotateCcw className="w-5 h-5" />
              Devoluciones
            </button>
            <button onClick={() => setCurrentSection("inventario")} className={navClase("inventario")}>
              <Package className="w-5 h-5" />
              Inventario
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="px-4 py-2 mb-2 text-xs text-gray-500 truncate">
            {user?.email || "Administrador"}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Moto Partes Pirueta
              </span>
              <h2 className="text-3xl font-black mt-2">
                {currentSection === "inicio" && "Panel Principal"}
                {currentSection === "ventas" && "Módulo de Ventas"}
                {currentSection === "pendientes" && "Pagos Pendientes"}
                {currentSection === "devoluciones" && "Módulo de Devoluciones y Cambios"}
                {currentSection === "inventario" && "Módulo de Inventario"}
              </h2>
              <p className="text-emerald-100 text-sm mt-1">
                Control seguro en la nube.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* TASA BCV */}
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-emerald-200" />
                <div>
                  <p className="text-xs text-emerald-100 font-medium">Precio del dólar BCV:</p>
                  {editandoTasa ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="number" 
                        step="0.01"
                        value={tempTasa}
                        onChange={(e) => setTempTasa(e.target.value)}
                        className="w-28 px-2 py-1 text-gray-900 text-sm rounded font-bold bg-white"
                      />
                      <button onClick={guardarTasa} className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded cursor-pointer">
                        Confirmar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">
                        {fmtBs(tasaBcv)} BS
                      </span>
                      <button 
                        onClick={() => { setTempTasa(tasaBcv.toString()); setEditandoTasa(true); }}
                        className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded font-medium transition cursor-pointer"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={obtenerTasaBcvOficial}
                        disabled={cargandoBcv}
                        className="p-1 bg-white/20 hover:bg-white/30 text-white rounded transition cursor-pointer"
                        title="Sincronizar BCV oficial exacto"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", cargandoBcv && "animate-spin")} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* TASA DIVISA */}
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-emerald-200" />
                <div>
                  <p className="text-xs text-emerald-100 font-medium">Tasa DIVISA:</p>
                  {editandoDivisa ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="number" 
                        step="0.01"
                        value={tempDivisa}
                        onChange={(e) => setTempDivisa(e.target.value)}
                        className="w-28 px-2 py-1 text-gray-900 text-sm rounded font-bold bg-white"
                      />
                      <button onClick={guardarTasaDivisa} className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded cursor-pointer">
                        Confirmar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">
                        {fmtBs(tasaDivisa)} BS
                      </span>
                      <button 
                        onClick={() => { setTempDivisa(tasaDivisa.toString()); setEditandoDivisa(true); }}
                        className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded font-medium transition cursor-pointer"
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl w-full mx-auto px-6 py-8">
          {currentSection === "inicio" && (
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Acciones rápidas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button 
                    onClick={() => { setModalVentaOpen(true); }}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition text-left flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Nueva Venta</p>
                        <p className="text-xs text-gray-500">Registrar transacción</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
                  </button>

                  <button 
                    onClick={() => setCurrentSection("devoluciones")}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition text-left flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition">
                        <RotateCcw className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Devoluciones</p>
                        <p className="text-xs text-gray-500">Gestionar cambios y retornos</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-amber-600" />
                  </button>

                  <button 
                    onClick={() => setCurrentSection("inventario")}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition text-left flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Inventario</p>
                        <p className="text-xs text-gray-500">Gestionar productos</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Resumen general</h3>
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div 
                    onClick={() => setCurrentSection("inventario")}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:border-emerald-500 transition flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Productos en inventario</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">{totalProductosRegistrados}</p>
                    </div>
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                      <Package className="w-7 h-7" />
                    </div>
                  </div>

                  <div 
                    onClick={() => setModalStockBajoOpen(true)}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:border-amber-500 transition flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock bajo (≤ 5)</p>
                      <p className="text-3xl font-black text-amber-600 mt-2">{productosStockBajo.length}</p>
                    </div>
                    <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                  </div>

                  <div 
                    onClick={() => setCurrentSection("ventas")}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:border-emerald-500 transition flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ventas registradas</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">{sales?.length || 0}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                      <CreditCard className="w-7 h-7" />
                    </div>
                  </div>

                  <div 
                    onClick={() => setCurrentSection("pendientes")}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:border-amber-500 transition flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pagos pendientes</p>
                      <p className="text-3xl font-black text-amber-600 mt-2">{ventasPendientes.length}</p>
                      {ventasPendientes.length > 0 && (
                        <p className="text-xs font-bold text-amber-700 mt-1">Por cobrar: ${totalPendienteDolares.toFixed(2)}</p>
                      )}
                    </div>
                    <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
                      <Clock className="w-7 h-7" />
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {currentSection === "ventas" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white rounded-2xl border border-gray-200 p-6 shadow-sm gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Historial y Registro de Ventas</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Filtra las ventas y genera reportes imprimibles.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setFiltroVentas("dia")}
                      className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer", filtroVentas === "dia" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                    >
                      Día
                    </button>
                    <button 
                      onClick={() => setFiltroVentas("semana")}
                      className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer", filtroVentas === "semana" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                    >
                      Semana
                    </button>
                    <button 
                      onClick={() => setFiltroVentas("mes")}
                      className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer", filtroVentas === "mes" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                    >
                      Mes
                    </button>
                  </div>
                  <Button onClick={generarReportePDF} variant="outline" className="border-gray-300 text-gray-700 font-bold flex items-center gap-2 cursor-pointer">
                    <Printer className="w-4 h-4" /> Generar Reporte
                  </Button>
                  <Button onClick={() => setModalVentaOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 cursor-pointer">
                    <Plus className="w-4 h-4" /> Nueva Venta
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {ventasFiltradas && ventasFiltradas.length > 0 ? (
                  ventasFiltradas.map((sale: any) => (
                    <div key={sale.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
                              Pago: {sale.metodoPago} {sale.referencia ? `(Ref: ${sale.referencia})` : ""}
                            </span>
                            {sale.pendiente && (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-amber-100 text-amber-800 rounded-lg"
                                title={`Pago pendiente de ${sale.cliente}: debe $${(sale.montoPendiente || 0).toFixed(2)}`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Pendiente
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">{new Date(sale.fecha).toLocaleString()} (ID: {sale.id.slice(0, 8)})</p>
                          {Array.isArray(sale.pagos) && sale.pagos.length > 1 && (
                            <p className="text-[11px] text-gray-500 mt-1">
                              {sale.pagos.map((p: any) => `${p.metodo}: ${p.metodo === "Divisas" ? "$" + p.monto.toFixed(2) : fmtBs(p.monto) + " BS"}`).join(" · ")}
                            </p>
                          )}
                          {sale.vuelto && (
                            <p className="text-[11px] text-gray-500 mt-1">
                              Vuelto entregado: ${sale.vuelto.dolares.toFixed(2)} ({fmtBs(sale.vuelto.bsBcv)} BS BCV / {fmtBs(sale.vuelto.bsDivisa)} BS divisa)
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-emerald-600">${sale.totalDolares.toFixed(2)}</p>
                          <p className="text-xs font-bold text-gray-500">{fmtBs(sale.totalBs)} BS</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-500 uppercase">Productos vendidos:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sale.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-xl text-xs">
                              <span className="font-bold text-gray-800">{item.qty}x {item.nombre}</span>
                              <span className="text-gray-600">${(item.pVenta * item.qty).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                    No hay ventas registradas para este filtro de tiempo.
                  </div>
                )}
              </div>
            </div>
          )}

          {currentSection === "pendientes" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white rounded-2xl border border-gray-200 p-6 shadow-sm gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Ventas con pago pendiente</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Abre una venta para registrar un abono o finalizar el pago.</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total por cobrar</p>
                  <p className="text-2xl font-black text-amber-600">${totalPendienteDolares.toFixed(2)}</p>
                  <p className="text-xs font-bold text-gray-500">{fmtBs(totalPendienteDolares * tasaBcv)} BS</p>
                </div>
              </div>

              <div className="space-y-4">
                {ventasPendientes.length > 0 ? (
                  ventasPendientes.map((sale: any) => (
                    <div
                      key={sale.id}
                      onClick={() => abrirPendiente(sale.id)}
                      className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:border-amber-500 hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{sale.cliente || "Cliente sin nombre"}</p>
                          <p className="text-xs text-gray-400">{new Date(sale.fecha).toLocaleString()} (ID: {sale.id.slice(0, 8)})</p>
                          <p className="text-[11px] text-gray-500 mt-1">{sale.items.map((i: any) => `${i.qty}x ${i.nombre}`).join(", ")}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Total venta: ${sale.totalDolares.toFixed(2)}</p>
                        <p className="text-lg font-black text-amber-600">Debe: ${(sale.montoPendiente || 0).toFixed(2)}</p>
                        <p className="text-xs font-bold text-gray-500">{fmtBs((sale.montoPendiente || 0) * tasaBcv)} BS</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                    No hay pagos pendientes. ¡Todo al día!
                  </div>
                )}
              </div>
            </div>
          )}

          {currentSection === "devoluciones" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white rounded-2xl border border-gray-200 p-6 shadow-sm gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Control de Devoluciones y Cambios</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Busca una venta anterior para procesar retornos, reembolsos o intercambios de repuestos.</p>
                </div>
                <Button 
                  onClick={() => { setModalDevolucionOpen(true); }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Registrar Nueva Devolución
                </Button>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Historial de Devoluciones en la Nube</h4>
                {devoluciones && devoluciones.length > 0 ? (
                  devoluciones.map((dev: any) => (
                    <div key={dev.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-3 gap-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
                            <RotateCcw className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg uppercase">
                              {dev.tipo}
                            </span>
                            <p className="text-xs text-gray-400 mt-1">{new Date(dev.fecha).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-amber-700">Reembolso: {fmtBs(dev.montoReembolsoBs || 0)} BS</p>
                          <p className="text-xs text-gray-500 font-medium">Comisión: {dev.comision || "N/A"}</p>
                        </div>
                      </div>
                      <div className="text-xs space-y-1 text-gray-700">
                        <p><strong>Detalle:</strong> {dev.detalle}</p>
                        <p><strong>Producto devuelto:</strong> {dev.productoDevuelto}</p>
                        {dev.tipo === "cambio" && <p><strong>Producto de cambio:</strong> {dev.productoNuevo}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                    No hay devoluciones registradas todavía.
                  </div>
                )}
              </div>
            </div>
          )}

          {currentSection === "inventario" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white rounded-2xl border border-gray-200 p-6 shadow-sm gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Inventario y Precios Automáticos</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Los precios de venta y bolívares se calculan con base en la Tasa BCV ({fmtBs(tasaBcv)} BS).</p>
                </div>
                <Button onClick={abrirModalNuevo} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2 cursor-pointer">
                  <Plus className="w-4 h-4" /> Agregar Producto
                </Button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input 
                    type="text" 
                    value={busquedaInventario}
                    onChange={(e) => setBusquedaInventario(e.target.value)}
                    placeholder="Buscar repuesto por nombre o código en el inventario..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-black text-gray-600 uppercase tracking-wider">
                        <th className="py-4 px-6">Código</th>
                        <th className="py-4 px-6">Nombre</th>
                        <th className="py-4 px-6 text-center">Cantidad</th>
                        <th className="py-4 px-6 text-right">P. Compra ($)</th>
                        <th className="py-4 px-6 text-right">P. Venta ($)</th>
                        <th className="py-4 px-6 text-right">P. Final (BS)</th>
                        <th className="py-4 px-6 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {productosFiltradosInventario && productosFiltradosInventario.length > 0 ? (
                        productosFiltradosInventario.map((prod: any) => {
                          const calc = calcularPrecios(prod.pCompra);
                          return (
                            <tr key={prod.id} className="hover:bg-gray-50/80 transition">
                              <td className="py-4 px-6 font-mono font-bold text-gray-700">{prod.codigo}</td>
                              <td className="py-4 px-6 font-bold text-gray-900">{prod.nombre}</td>
                              <td className="py-4 px-6 text-center">
                                <span className={cn("px-2.5 py-1 rounded-lg text-xs font-bold", prod.cantidad > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700")}>
                                  {prod.cantidad} un.
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right font-medium text-gray-600">${prod.pCompra.toFixed(2)}</td>
                              <td className="py-4 px-6 text-right font-bold text-emerald-600">${calc.pVenta.toFixed(2)}</td>
                              <td className="py-4 px-6 text-right font-black text-gray-900">{fmtBs(calc.pFinalBs)} BS</td>
                              <td className="py-4 px-6 text-center flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => abrirModalEditar(prod)} 
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => eliminarProducto(prod.id)} 
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-gray-500">
                            No se encontraron productos en la base de datos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: DETALLE DE PAGO PENDIENTE */}
      {ventaPendienteActual && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">Pago pendiente</h3>
                  <p className="text-xs text-gray-500">{new Date(ventaPendienteActual.fecha).toLocaleString()} (ID: {ventaPendienteActual.id.slice(0, 8)})</p>
                </div>
              </div>
              <button 
                onClick={cerrarPendiente}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">Cliente</span>
                <span className="text-sm font-black text-gray-900">{ventaPendienteActual.cliente || "Sin nombre"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">Total de la venta</span>
                <span className="text-sm font-bold text-gray-700">${ventaPendienteActual.totalDolares.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">Ya pagado</span>
                <span className="text-sm font-bold text-emerald-700">
                  ${Math.max(0, ventaPendienteActual.totalDolares - ventaPendienteActual.montoPendiente).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-amber-100 pt-2">
                <span className="text-sm font-bold text-gray-700">Monto que debe</span>
                <div className="text-right">
                  <p className="text-xl font-black text-amber-600">${ventaPendienteActual.montoPendiente.toFixed(2)}</p>
                  <p className="text-xs font-bold text-gray-500">{fmtBs(ventaPendienteActual.montoPendiente * tasaBcv)} BS</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase">Productos:</p>
              <div className="space-y-2">
                {ventaPendienteActual.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-xl text-xs">
                    <span className="font-bold text-gray-800">{item.qty}x {item.nombre}</span>
                    <span className="text-gray-600">${(item.pVenta * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {Array.isArray(ventaPendienteActual.pagos) && ventaPendienteActual.pagos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase">Pagos registrados:</p>
                <div className="space-y-1">
                  {ventaPendienteActual.pagos.map((p: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                      <span>
                        {p.tipo === "abono" ? "Abono" : p.tipo === "final" ? "Pago final" : "Pago inicial"} · {p.metodo} · {new Date(p.fecha).toLocaleDateString()}
                      </span>
                      <span className="font-bold">
                        {p.metodo === "Divisas" ? `$${p.monto.toFixed(2)}` : `${fmtBs(p.monto)} BS`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {modoPendiente === "detalle" && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <Button
                  onClick={() => setModoPendiente("abonar")}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl cursor-pointer"
                >
                  Abonar
                </Button>
                <Button
                  onClick={() => setModoPendiente("finalizar")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl cursor-pointer"
                >
                  Pago finalizado
                </Button>
              </div>
            )}

            {modoPendiente === "abonar" && (
              <div className="space-y-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-600 uppercase">Registrar abono</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {METODOS_PAGO.map((metodo) => (
                    <button
                      key={metodo}
                      type="button"
                      onClick={() => { setAbonoMetodo(metodo); setAbonoRef(""); }}
                      className={cn(
                        "py-2 px-3 text-xs font-bold rounded-xl border transition text-center cursor-pointer",
                        abonoMetodo === metodo ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {metodo}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Monto del abono {abonoMetodo === "Divisas" ? "($)" : "(BS)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={abonoMonto}
                    onChange={(e) => setAbonoMonto(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {abonoMontoNum > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Equivale a ${abonoDolares.toFixed(2)} · Quedaría debiendo ${Math.max(0, ventaPendienteActual.montoPendiente - abonoDolares).toFixed(2)}
                    </p>
                  )}
                </div>
                {necesitaReferencia(abonoMetodo) && (
                  <input
                    type="text"
                    maxLength={4}
                    value={abonoRef}
                    onChange={(e) => setAbonoRef(e.target.value.replace(/\D/g, ""))}
                    placeholder="Referencia: últimos 4 dígitos (Ej: 4829)"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                )}
                {errorAbono && abonoMontoNum > 0 && <p className="text-xs font-bold text-amber-700">{errorAbono}</p>}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModoPendiente("detalle")}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Volver
                  </button>
                  <Button
                    onClick={procesarAbono}
                    disabled={!!errorAbono || guardandoPendiente}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer"
                  >
                    {guardandoPendiente ? "Guardando..." : "Confirmar abono"}
                  </Button>
                </div>
              </div>
            )}

            {modoPendiente === "finalizar" && (
              <div className="space-y-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-600 uppercase">
                  ¿Con qué pagó los ${ventaPendienteActual.montoPendiente.toFixed(2)} restantes?
                </p>
                <SelectorPagos
                  form={pagoFinal}
                  auto={autoFinal}
                  objetivoDolares={debeDolares}
                  objetivoBs={debeBs}
                />
                {errorFinal && (pagosFinalPreview.length > 0 || pagoFinal.metodos.length > 0) && !autoFinal && (
                  <p className="text-xs font-bold text-amber-700">{errorFinal}</p>
                )}
                {autoFinal && errorFinal && <p className="text-xs font-bold text-amber-700">{errorFinal}</p>}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setModoPendiente("detalle"); pagoFinal.reset(); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Volver
                  </button>
                  <Button
                    onClick={procesarPagoFinalizado}
                    disabled={!!errorFinal || guardandoPendiente}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer"
                  >
                    {guardandoPendiente ? "Guardando..." : "Finalizar pago"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR DEVOLUCIÓN O CAMBIO */}
      {modalDevolucionOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">Procesar Devolución / Cambio</h3>
                  <p className="text-xs text-gray-500">Selecciona la venta y el producto afectado</p>
                </div>
              </div>
              <button 
                onClick={() => setModalDevolucionOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">1. Buscar venta realizada</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input 
                    type="text" 
                    value={busquedaVentaDev}
                    onChange={(e) => setBusquedaVentaDev(e.target.value)}
                    placeholder="Buscar por ID de venta o nombre del repuesto..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50"
                  />
                </div>

                {busquedaVentaDev.trim() !== "" && !ventaSeleccionadaDev && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {sales.filter(s => 
                      s.id.toLowerCase().includes(busquedaVentaDev.toLowerCase()) || 
                      s.items.some((i: any) => i.nombre.toLowerCase().includes(busquedaVentaDev.toLowerCase()))
                    ).map(sale => (
                      <div key={sale.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <p className="font-bold text-gray-900 text-xs">Venta ID: {sale.id.slice(0, 10)} | Fecha: {new Date(sale.fecha).toLocaleString()}</p>
                          <p className="text-[11px] text-gray-500">{sale.items.map((i: any) => `${i.qty}x ${i.nombre}`).join(", ")}</p>
                        </div>
                        <Button 
                          onClick={() => { setVentaSeleccionadaDev(sale); setBusquedaVentaDev(""); }}
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs cursor-pointer"
                        >
                          Seleccionar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {ventaSeleccionadaDev && (
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-emerald-800">Venta: {ventaSeleccionadaDev.id.slice(0, 10)}</span>
                      <p className="text-[11px] text-emerald-700 mt-0.5">Fecha de la venta: <strong>{new Date(ventaSeleccionadaDev.fecha).toLocaleString()}</strong></p>
                    </div>
                    <button onClick={() => setVentaSeleccionadaDev(null)} className="text-xs text-red-600 font-bold hover:underline cursor-pointer">Cambiar venta</button>
                  </div>
                  <p className="text-xs font-bold text-gray-600 uppercase">2. Selecciona el producto que se devuelve:</p>
                  <div className="space-y-2">
                    {ventaSeleccionadaDev.items.map((item: any, idx: number) => (
                      <div 
                        key={idx} 
                        onClick={() => {
                          setProductoDevueltoItem(item);
                          setMontoReembolso((item.pFinalBs * item.qty).toFixed(2));
                        }}
                        className={cn(
                          "p-3 rounded-xl border flex justify-between items-center cursor-pointer transition",
                          productoDevueltoItem?.id === item.id ? "bg-amber-600 text-white border-amber-600 font-bold" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        <span>{item.qty}x {item.nombre}</span>
                        <span>{fmtBs(item.pFinalBs * item.qty)} BS</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {productoDevueltoItem && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">3. Tipo de Operación</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTipoDevolucion("devolucion")}
                        className={cn("py-2.5 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center", tipoDevolucion === "devolucion" ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-white text-gray-700 border-gray-200")}
                      >
                        Devolución / Reembolso
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoDevolucion("cambio")}
                        className={cn("py-2.5 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center", tipoDevolucion === "cambio" ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-white text-gray-700 border-gray-200")}
                      >
                        Cambio por otro producto
                      </button>
                    </div>
                  </div>

                  {tipoDevolucion === "cambio" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecciona el producto nuevo de reemplazo</label>
                      <select 
                        onChange={(e) => {
                          const prod = products.find(p => p.id === e.target.value);
                          setProductoCambioSeleccionado(prod);
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">-- Elige un producto del inventario --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.cantidad})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto a devolver (BS)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={montoReembolso}
                        onChange={(e) => setMontoReembolso(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Comisión / Nota</label>
                      <input 
                        type="text" 
                        value={comisionDevolucion}
                        onChange={(e) => setComisionDevolucion(e.target.value)}
                        placeholder="Ej: 5% por reposición"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalDevolucionOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <Button
                  onClick={procesarDevolucionOCambio}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm cursor-pointer"
                  disabled={!ventaSeleccionadaDev || !productoDevueltoItem || guardandoDevolucionState}
                >
                  {guardandoDevolucionState ? "Procesando..." : "Confirmar Devolución"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Stock Bajo */}
      {modalStockBajoOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">Productos con Stock Bajo</h3>
                  <p className="text-xs text-gray-500">Unidades disponibles menores o iguales a 5</p>
                </div>
              </div>
              <button 
                onClick={() => setModalStockBajoOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {productosStockBajo.length > 0 ? (
                productosStockBajo.map((prod: any) => (
                  <div key={prod.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <div>
                      <p className="font-mono text-xs font-bold text-gray-500">{prod.codigo}</p>
                      <p className="font-bold text-gray-900 text-sm mt-0.5">{prod.nombre}</p>
                    </div>
                    <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-xl text-xs font-black">
                      {prod.cantidad} un.
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-gray-500 border border-dashed border-gray-200 rounded-2xl">
                  ¡Excelente! No hay productos con stock bajo en este momento.
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button 
                onClick={() => setModalStockBajoOpen(false)}
                className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nueva Venta */}
      {modalVentaOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900">Registrar Nueva Venta</h3>
              <button 
                onClick={() => setModalVentaOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar producto en inventario</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input 
                    type="text" 
                    value={busquedaProducto}
                    onChange={(e) => setBusquedaProducto(e.target.value)}
                    placeholder="Escribe el nombre o código del repuesto..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {busquedaProducto.trim() !== "" && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {products.filter(p => p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) || p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())).map(prod => {
                      const calc = calcularPrecios(prod.pCompra);
                      return (
                        <div key={prod.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{prod.nombre}</p>
                            <p className="text-xs text-gray-500">Stock: {prod.cantidad} | Venta: ${calc.pVenta} ({fmtBs(calc.pFinalBs)} BS)</p>
                          </div>
                          <Button 
                            onClick={() => { agregarAlCarrito(prod); setBusquedaProducto(""); }}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs cursor-pointer"
                            disabled={prod.cantidad <= 0}
                          >
                            {prod.cantidad > 0 ? "Agregar" : "Agotado"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase">Productos en la venta:</p>
                {carrito.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {carrito.map(item => (
                      <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{item.nombre}</p>
                          <p className="text-xs text-gray-500">${item.pVenta} c/u ({fmtBs(item.pFinalBs)} BS)</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 bg-white border border-gray-200 px-2 py-1 rounded-lg">
                            <button onClick={() => cambiarCantidadCarrito(item.id, -1)} className="text-gray-500 font-bold px-1 cursor-pointer">-</button>
                            <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                            <button onClick={() => cambiarCantidadCarrito(item.id, 1)} className="text-gray-500 font-bold px-1 cursor-pointer">+</button>
                          </div>
                          <span className="font-bold text-emerald-600 text-sm w-16 text-right">${(item.pVenta * item.qty).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-xl">Ningún producto seleccionado todavía.</p>
                )}
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-600">Total Venta ($):</span>
                  <span className="text-xl font-black text-emerald-700">${totalVentaDolares.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-emerald-100/60 pt-2">
                  <span className="text-sm font-bold text-gray-600">Total Venta (BS):</span>
                  <span className="text-xl font-black text-gray-900">{fmtBs(totalVentaBs)} BS</span>
                </div>

                {/* Opciones especiales */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100/60">
                  <button
                    type="button"
                    disabled={!vueltoDisponible}
                    onClick={() => setDarVuelto(!darVuelto)}
                    title={!vueltoDisponible ? "Selecciona el método Divisas (y que no sea pago pendiente) para dar vuelto" : ""}
                    className={cn(
                      "py-2 px-3 text-xs font-bold rounded-xl border transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                      vueltoActivo ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <Coins className="w-4 h-4" /> Dar vuelto
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEsPagoPendiente(!esPagoPendiente); setDarVuelto(false); }}
                    className={cn(
                      "py-2 px-3 text-xs font-bold rounded-xl border transition flex items-center justify-center gap-2 cursor-pointer",
                      esPagoPendiente ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <AlertTriangle className="w-4 h-4" /> Pago pendiente
                  </button>
                </div>

                {esPagoPendiente && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                    <label className="block text-xs font-bold text-amber-800 uppercase">Nombre del cliente</label>
                    <input
                      type="text"
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="w-full px-4 py-2.5 rounded-xl border border-amber-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-amber-800">
                      Anota abajo lo que el cliente paga ahora (puede ser 0). El resto quedará pendiente.
                    </p>
                    <div className="flex justify-between text-xs font-bold text-amber-900">
                      <span>Paga ahora: ${pagadoVentaDolares.toFixed(2)}</span>
                      <span>Quedará pendiente: ${pendienteVentaDolares.toFixed(2)} ({fmtBs(pendienteVentaDolares * tasaBcv)} BS)</span>
                    </div>
                  </div>
                )}

                <SelectorPagos
                  form={pagoVenta}
                  auto={autoCompleto}
                  objetivoDolares={totalVentaDolares}
                  objetivoBs={totalVentaBs}
                  ocultarDivisa={vueltoActivo}
                />

                {vueltoActivo && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-blue-900">
                      <span>A cubrir con divisa:</span>
                      <span>${restanteDivisa.toFixed(2)}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Monto recibido en divisa ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        placeholder="Ej: 100"
                        className="w-full px-4 py-2.5 rounded-xl border border-blue-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {recibidoNum > 0 && recibidoNum >= restanteDivisa - TOLERANCIA && (
                      <div className="bg-white rounded-xl border border-blue-100 p-3 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-600">Vuelto a dar ($):</span>
                          <span className="text-lg font-black text-blue-700">${vueltoDolares.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600">En BS (tasa BCV {fmtBs(tasaBcv)}):</span>
                          <span className="font-black text-gray-900">{fmtBs(vueltoBsBcv)} BS</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600">En BS (tasa DIVISA {fmtBs(tasaDivisa)}):</span>
                          <span className="font-black text-gray-900">{fmtBs(vueltoBsDivisa)} BS</span>
                        </div>
                        {tasaDivisa <= 0 && (
                          <p className="text-[11px] text-amber-700 font-bold">Configura la Tasa DIVISA en el encabezado para ver este monto.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {errorVenta && carrito.length > 0 && (
                <p className="text-xs font-bold text-amber-700 text-right">{errorVenta}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalVentaOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <Button
                  onClick={confirmarVenta}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm cursor-pointer"
                  disabled={!!errorVenta || guardandoVenta}
                >
                  {guardandoVenta ? "Guardando..." : "Confirmar y Guardar Venta"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nuevo/Editar Producto */}
      {modalProductoOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900">
                {editandoId ? "Editar Producto" : "Nuevo Producto en Inventario"}
              </h3>
              <button 
                type="button"
                onClick={() => setModalProductoOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={guardarProducto} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código</label>
                <input 
                  type="text" 
                  value={formCodigo}
                  onChange={(e) => setFormCodigo(e.target.value)}
                  placeholder="Ej: MP-003"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Producto</label>
                <input 
                  type="text" 
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej: Pastillas de freno trasera"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cantidad</label>
                  <input 
                    type="number" 
                    value={formCantidad}
                    onChange={(e) => setFormCantidad(e.target.value)}
                    placeholder="10"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Precio Compra ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formPCompra}
                    onChange={(e) => setFormPCompra(e.target.value)}
                    placeholder="5.00"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {formPCompra && !isNaN(parseFloat(formPCompra)) && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 mt-4">
                  <p className="text-xs font-bold text-gray-500 uppercase">Cálculos automáticos en vivo:</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Precio Venta ($):</span>
                    <span className="font-bold text-emerald-600">${calcularPrecios(parseFloat(formPCompra)).pVenta.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Precio Final (BS):</span>
                    <span className="font-black text-gray-900">{fmtBs(calcularPrecios(parseFloat(formPCompra)).pFinalBs)} BS</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalProductoOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoProductoState}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {guardandoProductoState ? "Guardando..." : (editandoId ? "Actualizar Producto" : "Guardar Producto")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
