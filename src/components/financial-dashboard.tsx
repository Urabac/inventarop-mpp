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
  Minus,
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
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, writeBatch, increment } from "firebase/firestore";
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
const redondear = (n: number) => Number((n || 0).toFixed(2));
const escapeHtml = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// Resumen de métodos usados: "Efectivo + Pago movil" (solo cuenta los cobros, no los reembolsos)
const resumenMetodos = (pagos: any[]) =>
  Array.from(new Set(pagos.filter((p) => p.monto > 0).map((p) => p.metodo))).join(" + ");
const resumenReferencias = (pagos: any[]) =>
  pagos.filter((p) => p.monto > 0).map((p) => p.referencia).filter(Boolean).join(", ");

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

// Muestra un pago en su moneda nativa (los reembolsos salen con signo negativo)
const fmtPago = (p: any) => {
  const abs = Math.abs(p.monto || 0);
  const txt = p.metodo === "Divisas" ? `$${abs.toFixed(2)}` : `${fmtBs(abs)} BS`;
  return p.monto < 0 ? `-${txt}` : txt;
};

const etiquetaTipoPago = (tipo: string) =>
  tipo === "abono" ? "Abono"
  : tipo === "final" ? "Pago final"
  : tipo === "devolucion" ? "Reembolso"
  : tipo === "cambio" ? "Cobro por cambio"
  : "Pago inicial";

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
  pagadoDolares = 0,
  tasa = 1,
  ocultarMetodo = null
}: {
  form: FormPagos;
  auto: boolean;
  objetivoDolares: number;
  objetivoBs: number;
  pagadoDolares?: number;
  tasa?: number;
  ocultarMetodo?: string | null;
}) {
  const porPagarDolares = Math.max(0, objetivoDolares - pagadoDolares);
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
              ) : ocultarMetodo === m ? (
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
        <>
          <p className="text-[11px] text-gray-500">
            Anota cuánto paga con cada método. Efectivo, Pago móvil y Transferencia se anotan en BS; Divisas en $.
          </p>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <span className="font-bold text-gray-500 uppercase">Total a cubrir</span>
              <span className="font-bold text-gray-800">${objetivoDolares.toFixed(2)} · {fmtBs(objetivoBs)} BS</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-bold text-gray-500 uppercase">Ya anotado</span>
              <span className="font-bold text-emerald-700">${pagadoDolares.toFixed(2)} · {fmtBs(pagadoDolares * tasa)} BS</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-gray-200 pt-1.5">
              <span className="font-black text-gray-700 uppercase">Monto por pagar</span>
              <span className="font-black text-amber-700">${porPagarDolares.toFixed(2)} · {fmtBs(porPagarDolares * tasa)} BS</span>
            </div>
          </div>
        </>
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
  const [ventaDevId, setVentaDevId] = useState<string | null>(null);
  const [indiceItemDev, setIndiceItemDev] = useState<number | null>(null);
  const [cantidadDevolver, setCantidadDevolver] = useState("1");
  const [tipoDevolucion, setTipoDevolucion] = useState<"devolucion" | "cambio">("devolucion");
  const [productoCambioId, setProductoCambioId] = useState("");
  const [cantidadCambio, setCantidadCambio] = useState("1");
  const [metodoLiq, setMetodoLiq] = useState("Efectivo");
  const [montoLiqManual, setMontoLiqManual] = useState("");
  const [refLiq, setRefLiq] = useState("");
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
  // Precio final editable (rebajas). null = se usa el total calculado del carrito.
  const [totalEditado, setTotalEditado] = useState<{ d: string; bs: string } | null>(null);
  const [darVuelto, setDarVuelto] = useState(false);
  const [metodoVuelto, setMetodoVuelto] = useState("Divisas");
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

  // Si cambian los productos del carrito, el precio editado deja de aplicar y vuelve el total calculado
  useEffect(() => {
    setTotalEditado(null);
  }, [carrito]);

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
  // Texto "$X (Y BS)" para mensajes
  const fmtDolaresYBs = (d: number) => `$${d.toFixed(2)} (${fmtBs(d * tasaBcvSegura)} BS)`;

  // Arma la lista de pagos a partir de un formulario de métodos de pago.
  // "fijo" permite fijar el monto de un método (el que lleva vuelto) con lo que realmente se queda.
  const armarPagos = (
    form: { metodos: string[]; montos: Record<string, string>; refs: Record<string, string> },
    auto: boolean,
    objetivoDolares: number,
    objetivoBs: number,
    tipo: string,
    fecha: string,
    fijo: { metodo: string; monto: number; montoDolares: number } | null = null
  ) => {
    const lista: any[] = [];
    form.metodos.forEach((m) => {
      let monto = 0;
      let montoDolares = 0;
      if (fijo && m === fijo.metodo) {
        monto = fijo.monto;
        montoDolares = fijo.montoDolares;
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

  const eliminarProducto = async (id: string, nombre?: string) => {
    if (!window.confirm(`¿Eliminar "${nombre || "este producto"}" del inventario? Esta acción no se puede deshacer.`)) return;
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

  // Total calculado con los precios del inventario
  const totalCarritoDolares = carrito.reduce((sum, item) => sum + (item.pVenta * item.qty), 0);
  const totalCarritoBs = carrito.reduce((sum, item) => sum + (item.pFinalBs * item.qty), 0);

  // Total final de la venta: el calculado, o el que el vendedor editó para hacer una rebaja
  const editadoD = totalEditado ? parseFloat(totalEditado.d) : NaN;
  const editadoBs = totalEditado ? parseFloat(totalEditado.bs) : NaN;
  const hayTotalEditado = carrito.length > 0 && !isNaN(editadoD) && !isNaN(editadoBs) && editadoD > 0 && editadoBs > 0;
  const totalVentaDolares = hayTotalEditado ? editadoD : totalCarritoDolares;
  const totalVentaBs = hayTotalEditado ? editadoBs : totalCarritoBs;
  const rebajaDolares = hayTotalEditado ? totalCarritoDolares - totalVentaDolares : 0;
  const rebajaBs = hayTotalEditado ? totalCarritoBs - totalVentaBs : 0;

  // Editar el precio final en $ actualiza los Bs, y al revés
  const editarTotalDolares = (v: string) => {
    const n = parseFloat(v);
    setTotalEditado({ d: v, bs: !isNaN(n) && n > 0 ? (n * tasaBcvSegura).toFixed(2) : "" });
  };
  const editarTotalBs = (v: string) => {
    const n = parseFloat(v);
    setTotalEditado({ bs: v, d: !isNaN(n) && n > 0 ? (n / tasaBcvSegura).toFixed(2) : "" });
  };

  // --- CÁLCULOS DE PAGO DE LA NUEVA VENTA ---
  const autoCompleto = pagoVenta.metodos.length === 1 && !esPagoPendiente;

  // El vuelto se puede dar cuando se paga con Divisas ($) o con Efectivo (BS)
  const metodosVuelto = pagoVenta.metodos.filter((m) => m === "Divisas" || m === "Efectivo");
  const vueltoDisponible = metodosVuelto.length > 0 && !esPagoPendiente;
  const vueltoActivo = darVuelto && vueltoDisponible;
  const metodoVueltoSel = metodosVuelto.includes(metodoVuelto) ? metodoVuelto : (metodosVuelto[0] || "Divisas");

  // Lo que se paga con los demás métodos (para saber cuánto debe cubrir el método con vuelto)
  const pagosOtros = armarPagos(
    { ...pagoVenta, metodos: pagoVenta.metodos.filter((m) => m !== metodoVueltoSel) },
    false, totalVentaDolares, totalVentaBs, "venta", ""
  );
  const restanteDolares = vueltoActivo ? Math.max(0, totalVentaDolares - sumaDolares(pagosOtros)) : 0;
  const restanteBsVuelto = vueltoActivo
    ? (pagosOtros.length === 0 ? totalVentaBs : restanteDolares * tasaBcv)
    : 0;
  const restanteMetodo = metodoVueltoSel === "Divisas" ? restanteDolares : restanteBsVuelto;
  const recibidoNum = parseFloat(montoRecibido) || 0;
  const recibidoDolares = aDolares(metodoVueltoSel, recibidoNum);
  const vueltoMetodo = vueltoActivo ? Math.max(0, recibidoNum - restanteMetodo) : 0; // en la moneda del método
  const vueltoDolares = aDolares(metodoVueltoSel, vueltoMetodo);
  const vueltoBsBcv = metodoVueltoSel === "Divisas" ? vueltoDolares * tasaBcv : vueltoMetodo;
  const vueltoBsDivisa = vueltoDolares * tasaDivisa;

  const pagoFijoVuelto = vueltoActivo
    ? { metodo: metodoVueltoSel, monto: restanteMetodo, montoDolares: restanteDolares }
    : null;

  const pagosVentaPreview = armarPagos(
    pagoVenta, autoCompleto, totalVentaDolares, totalVentaBs, "venta", "", pagoFijoVuelto
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
    if (vueltoActivo && recibidoDolares < restanteDolares - TOLERANCIA) {
      return "El monto recibido es menor a lo que falta por pagar.";
    }
    if (pagadoVentaDolares < totalVentaDolares - TOLERANCIA) {
      return `Faltan ${fmtDolaresYBs(totalVentaDolares - pagadoVentaDolares)} por cubrir.`;
    }
    return null;
  };
  const errorVenta = validarVenta();

  const confirmarVenta = async () => {
    if (guardandoVenta || validarVenta()) return;

    setGuardandoVenta(true);
    try {
      const fecha = new Date().toISOString();
      const pagos = armarPagos(
        pagoVenta, autoCompleto, totalVentaDolares, totalVentaBs, "venta", fecha, pagoFijoVuelto
      );
      const montoPendiente = esPagoPendiente
        ? Number(Math.max(0, totalVentaDolares - sumaDolares(pagos)).toFixed(2))
        : 0;

      const nuevaVenta = {
        fecha,
        items: [...carrito],
        totalDolares: totalVentaDolares,
        totalBs: totalVentaBs,
        // Si se hizo una rebaja, se guarda el precio original para tener el registro
        ...(hayTotalEditado
          ? { precioOriginalDolares: redondear(totalCarritoDolares), precioOriginalBs: redondear(totalCarritoBs) }
          : {}),
        metodoPago: resumenMetodos(pagos) || "Pendiente",
        referencia: resumenReferencias(pagos),
        pagos,
        pendiente: esPagoPendiente,
        cliente: esPagoPendiente ? clienteNombre.trim() : "",
        montoPendiente,
        vuelto: vueltoActivo && vueltoDolares > 0
          ? {
              metodo: metodoVueltoSel,
              recibido: Number(recibidoNum.toFixed(2)),
              dolares: Number(vueltoDolares.toFixed(2)),
              bsBcv: Number(vueltoBsBcv.toFixed(2)),
              bsDivisa: Number(vueltoBsDivisa.toFixed(2))
            }
          : null
      };

      // Todo en un solo lote: o se guarda la venta y se descuenta el stock, o no se guarda nada
      const batch = writeBatch(db);
      carrito.forEach((item) => {
        if (products.some((p) => p.id === item.id)) {
          batch.update(doc(db, COLLECTION_INVENTARIO, item.id), { cantidad: increment(-item.qty) });
        }
      });
      batch.set(doc(collection(db, COLLECTION_VENTAS)), nuevaVenta);
      await batch.commit();

      setCarrito([]);
      setTotalEditado(null);
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
  const pagadoFinalDolares = sumaDolares(pagosFinalPreview);
  const validarFinal = (): string | null => {
    if (!ventaPendienteActual) return "Venta no encontrada.";
    if (pagosFinalPreview.some((p) => necesitaReferencia(p.metodo) && p.referencia.length !== 4)) {
      return "Ingresa los 4 últimos dígitos de la referencia.";
    }
    if (pagadoFinalDolares < debeDolares - TOLERANCIA) return `Faltan ${fmtDolaresYBs(debeDolares - pagadoFinalDolares)} por cubrir.`;
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

  // --- DEVOLUCIONES Y CAMBIOS ---
  const ventaDev = sales.find((s: any) => s.id === ventaDevId) || null;
  const itemDev = ventaDev && indiceItemDev !== null ? (ventaDev.items[indiceItemDev] || null) : null;
  const productoCambio = products.find((p) => p.id === productoCambioId) || null;
  const qtyDevNum = itemDev ? Math.min(itemDev.qty, Math.max(0, parseInt(cantidadDevolver) || 0)) : 0;
  const qtyCambioNum = Math.max(0, parseInt(cantidadCambio) || 0);

  // Stock disponible del producto nuevo (si es el mismo que se devuelve, también cuenta lo que vuelve)
  const stockDisponibleCambio = productoCambio
    ? productoCambio.cantidad + (itemDev && productoCambio.id === itemDev.id ? qtyDevNum : 0)
    : 0;

  // Resultado de la operación: nuevos ítems, nuevos totales y saldo entre cliente y negocio
  const calcDev = (() => {
    if (!ventaDev || !itemDev || qtyDevNum < 1) return null;
    const itemsRestantes = ventaDev.items.flatMap((it: any, i: number) => {
      if (i !== indiceItemDev) return [it];
      return it.qty - qtyDevNum > 0 ? [{ ...it, qty: it.qty - qtyDevNum }] : [];
    });
    let itemsFinales = itemsRestantes;
    let itemNuevo: any = null;
    if (tipoDevolucion === "cambio" && productoCambio && qtyCambioNum > 0) {
      const c = calcularPrecios(productoCambio.pCompra);
      itemNuevo = { ...productoCambio, pVenta: c.pVenta, pFinalBs: c.pFinalBs, qty: qtyCambioNum };
      itemsFinales = [...itemsRestantes, itemNuevo];
    }
    // Si la venta tuvo una rebaja, se mantiene la misma proporción en lo que queda de la venta
    // (en ventas sin rebaja el factor es 1 y nada cambia)
    const sumaOriginalD = ventaDev.items.reduce((a: number, i: any) => a + i.pVenta * i.qty, 0);
    const sumaOriginalBs = ventaDev.items.reduce((a: number, i: any) => a + i.pFinalBs * i.qty, 0);
    let factorD = sumaOriginalD > 0 ? ventaDev.totalDolares / sumaOriginalD : 1;
    let factorBs = sumaOriginalBs > 0 ? ventaDev.totalBs / sumaOriginalBs : 1;
    if (!isFinite(factorD) || Math.abs(factorD - 1) < 1e-6) factorD = 1;
    if (!isFinite(factorBs) || Math.abs(factorBs - 1) < 1e-6) factorBs = 1;
    const nuevoTotalDolares = redondear(itemsFinales.reduce((a: number, i: any) => a + i.pVenta * i.qty, 0) * factorD);
    const nuevoTotalBs = redondear(itemsFinales.reduce((a: number, i: any) => a + i.pFinalBs * i.qty, 0) * factorBs);
    const pagadoPrevio = sumaDolares(obtenerPagosVenta(ventaDev));
    // saldo > 0: el cliente debe pagar. saldo < 0: el negocio debe devolver dinero.
    const saldo = redondear(nuevoTotalDolares - pagadoPrevio);
    return {
      itemsFinales,
      itemNuevo,
      nuevoTotalDolares,
      nuevoTotalBs,
      saldo,
      valorDevueltoDolares: redondear(itemDev.pVenta * qtyDevNum),
      valorNuevoDolares: itemNuevo ? redondear(itemNuevo.pVenta * itemNuevo.qty) : 0
    };
  })();

  const saldoDev = calcDev ? calcDev.saldo : 0;
  const esVentaPendienteDev = !!(ventaDev && ventaDev.pendiente);
  // Si el cliente debe pagar y la venta ya era pendiente, simplemente aumenta lo que debe (no se cobra ahora)
  const liquidaAhora = !!calcDev && (saldoDev < -TOLERANCIA || (saldoDev > TOLERANCIA && !esVentaPendienteDev));
  const liqAutoMonto = liquidaAhora
    ? (metodoLiq === "Divisas" ? Math.abs(saldoDev) : Math.abs(saldoDev) * tasaBcvSegura)
    : 0;
  const liqMontoNum = montoLiqManual !== "" ? (parseFloat(montoLiqManual) || 0) : liqAutoMonto;
  const liqDolares = aDolares(metodoLiq, liqMontoNum);

  const validarDevolucion = (): string | null => {
    if (!ventaDev || !itemDev) return "Selecciona la venta y el producto.";
    if (qtyDevNum < 1 || qtyDevNum > itemDev.qty) return `La cantidad a devolver debe estar entre 1 y ${itemDev.qty}.`;
    if (tipoDevolucion === "cambio") {
      if (!productoCambio) return "Selecciona el producto de reemplazo.";
      if (qtyCambioNum < 1) return "Indica la cantidad del producto nuevo.";
      if (qtyCambioNum > stockDisponibleCambio) return "No hay suficiente stock del producto nuevo.";
    }
    if (liquidaAhora) {
      if (liqMontoNum <= 0) return saldoDev < 0 ? "Indica el monto a entregar al cliente." : "Indica el monto que paga el cliente.";
      if (necesitaReferencia(metodoLiq) && refLiq.length !== 4) return "Ingresa los 4 últimos dígitos de la referencia.";
      if (saldoDev > 0 && liqDolares < saldoDev - TOLERANCIA) return `El cliente debe pagar ${fmtDolaresYBs(saldoDev)}.`;
      if (saldoDev < 0 && liqDolares > -saldoDev + TOLERANCIA) return `No puedes entregar más de ${fmtDolaresYBs(-saldoDev)}.`;
    }
    return null;
  };
  const errorDevolucion = validarDevolucion();

  const cerrarModalDevolucion = () => {
    setModalDevolucionOpen(false);
    setBusquedaVentaDev("");
    setVentaDevId(null);
    setIndiceItemDev(null);
    setCantidadDevolver("1");
    setTipoDevolucion("devolucion");
    setProductoCambioId("");
    setCantidadCambio("1");
    setMetodoLiq("Efectivo");
    setMontoLiqManual("");
    setRefLiq("");
    setComisionDevolucion("");
  };

  const cambiarCantidadDevolver = (delta: number) => {
    if (!itemDev) return;
    const n = Math.min(itemDev.qty, Math.max(1, (qtyDevNum || 1) + delta));
    setCantidadDevolver(String(n));
    setMontoLiqManual("");
  };

  const cambiarCantidadCambio = (delta: number) => {
    const n = Math.max(1, Math.min(stockDisponibleCambio || 1, (qtyCambioNum || 1) + delta));
    setCantidadCambio(String(n));
    setMontoLiqManual("");
  };

  const procesarDevolucionOCambio = async () => {
    if (guardandoDevolucionState || validarDevolucion() || !ventaDev || !itemDev || !calcDev) return;
    setGuardandoDevolucionState(true);

    try {
      const fecha = new Date().toISOString();
      const batch = writeBatch(db);

      // Stock: vuelve lo devuelto y sale lo entregado en el cambio
      if (products.some((p) => p.id === itemDev.id)) {
        batch.update(doc(db, COLLECTION_INVENTARIO, itemDev.id), { cantidad: increment(qtyDevNum) });
      }
      if (tipoDevolucion === "cambio" && productoCambio && calcDev.itemNuevo) {
        batch.update(doc(db, COLLECTION_INVENTARIO, productoCambio.id), { cantidad: increment(-qtyCambioNum) });
      }

      // Pagos: si hay dinero que entregar o cobrar, queda registrado dentro de la venta
      let pagos = obtenerPagosVenta(ventaDev);
      let liquidacion: any = null;
      if (liquidaAhora) {
        const signo = saldoDev < 0 ? -1 : 1;
        const pagoLiq = {
          fecha,
          tipo: saldoDev < 0 ? "devolucion" : "cambio",
          metodo: metodoLiq,
          monto: signo * redondear(liqMontoNum),
          montoDolares: signo * redondear(liqDolares),
          referencia: necesitaReferencia(metodoLiq) ? refLiq : ""
        };
        pagos = [...pagos, pagoLiq];
        liquidacion = {
          sentido: saldoDev < 0 ? "entregar" : "cobrar",
          metodo: metodoLiq,
          monto: redondear(liqMontoNum),
          montoDolares: redondear(liqDolares),
          montoBs: metodoLiq === "Divisas" ? redondear(liqDolares * tasaBcvSegura) : redondear(liqMontoNum)
        };
      }

      // Estado de pendiente de la venta
      let pendiente = !!ventaDev.pendiente;
      let montoPendiente = ventaDev.montoPendiente || 0;
      if (ventaDev.pendiente) {
        if (saldoDev > TOLERANCIA) {
          montoPendiente = saldoDev;
        } else {
          pendiente = false;
          montoPendiente = 0;
        }
      }

      const ventaAnulada = calcDev.itemsFinales.length === 0;
      batch.update(doc(db, COLLECTION_VENTAS, ventaDev.id), {
        items: calcDev.itemsFinales,
        totalDolares: calcDev.nuevoTotalDolares,
        totalBs: calcDev.nuevoTotalBs,
        pagos,
        metodoPago: resumenMetodos(pagos) || (ventaAnulada ? "Devuelta" : "Pendiente"),
        referencia: resumenReferencias(pagos),
        pendiente,
        montoPendiente,
        devuelta: ventaAnulada
      });

      const detalleOperacion =
        tipoDevolucion === "devolucion"
          ? (ventaAnulada ? `Devolución de ${qtyDevNum}x ${itemDev.nombre} (venta devuelta por completo)` : `Devolución parcial de ${qtyDevNum}x ${itemDev.nombre}`)
          : `Cambio de ${qtyDevNum}x [${itemDev.nombre}] por ${qtyCambioNum}x [${productoCambio?.nombre}]`;

      batch.set(doc(collection(db, COLLECTION_DEVOLUCIONES)), {
        fecha,
        ventaId: ventaDev.id,
        tipo: tipoDevolucion,
        detalle: detalleOperacion,
        productoDevuelto: itemDev.nombre,
        cantidadDevuelta: qtyDevNum,
        productoNuevo: productoCambio && tipoDevolucion === "cambio" ? productoCambio.nombre : "N/A",
        cantidadNueva: tipoDevolucion === "cambio" ? qtyCambioNum : 0,
        diferenciaDolares: saldoDev,
        liquidacion,
        montoReembolsoBs: liquidacion && liquidacion.sentido === "entregar" ? liquidacion.montoBs : 0,
        comision: comisionDevolucion || "Sin comisión"
      });

      await batch.commit();
      cerrarModalDevolucion();
    } catch (e: any) {
      console.error("Error al procesar devolución:", e);
    } finally {
      setTimeout(() => setGuardandoDevolucionState(false), 2000);
    }
  };

  // --- FILTRO DE PERIODO (lista de ventas y reporte) ---
  const dentroDelFiltro = (fechaIso: string) => {
    const f = new Date(fechaIso);
    const ahora = new Date();
    if (filtroVentas === "dia") {
      return f.toDateString() === ahora.toDateString();
    } else if (filtroVentas === "semana") {
      const unaSemanaAtras = new Date();
      unaSemanaAtras.setDate(ahora.getDate() - 7);
      return f >= unaSemanaAtras;
    } else if (filtroVentas === "mes") {
      return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
    }
    return true;
  };

  const ventasFiltradas = sales.filter((sale: any) => dentroDelFiltro(sale.fecha));

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

  // --- REPORTE DE VENTAS (sigue el filtro Día / Semana / Mes) ---
  const generarReportePDF = () => {
    const etiquetaPeriodo = filtroVentas === "dia" ? "Diario" : filtroVentas === "semana" ? "de los Últimos 7 Días" : "Mensual";

    const ventasPeriodo = sales.filter((sale: any) => dentroDelFiltro(sale.fecha));
    const devPeriodo = devoluciones.filter((dev: any) => dentroDelFiltro(dev.fecha));

    // Dinero realmente movido en el periodo (incluye abonos, pagos finales y reembolsos como negativos)
    const pagosPeriodo = sales
      .flatMap((s: any) => obtenerPagosVenta(s))
      .filter((p: any) => dentroDelFiltro(p.fecha));

    let efectivoBs = 0;
    let divisaDolar = 0;
    let pagoMovilBs = 0;
    let transferenciaBs = 0;

    pagosPeriodo.forEach((p: any) => {
      if (p.metodo === "Efectivo") efectivoBs += p.monto;
      else if (p.metodo === "Divisas") divisaDolar += p.monto;
      else if (p.metodo === "Pago movil") pagoMovilBs += p.monto;
      else if (p.metodo === "Transferencia") transferenciaBs += p.monto;
    });

    const totalCobradoDolar = sumaDolares(pagosPeriodo);
    const reembolsosDolar = Math.abs(sumaDolares(pagosPeriodo.filter((p: any) => p.monto < 0)));
    const totalPorCobrarDolar = ventasPendientes.reduce((acc: number, s: any) => acc + (s.montoPendiente || 0), 0);

    // Los totales de cada venta ya vienen ajustados por devoluciones y cambios
    const totalDolarPeriodo = ventasPeriodo.reduce((acc, s) => acc + s.totalDolares, 0);
    const totalBsPeriodo = ventasPeriodo.reduce((acc, s) => acc + s.totalBs, 0);

    const totalDevueltoBs = devPeriodo.reduce((acc, d) => acc + (d.montoReembolsoBs || 0), 0);
    const totalDevueltoDolar = totalDevueltoBs / tasaBcvSegura;

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
          <p class="subtitle">Reporte ${etiquetaPeriodo} de Ventas (Neto con Devoluciones)</p>
          <div class="info">
            <strong>Fecha del reporte:</strong> ${new Date().toLocaleDateString()} <br>
            <strong>Tasa BCV aplicada:</strong> ${fmtBs(tasaBcv)} BS <br>
            <strong>Tasa DIVISA:</strong> ${fmtBs(tasaDivisa)} BS
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Método de Pago</th>
                <th>Ref.</th>
                <th>Productos Vendidos</th>
                <th class="num">Total ($)</th>
                <th class="num">Total (BS)</th>
              </tr>
            </thead>
            <tbody>
              ${ventasPeriodo.map(s => `
                <tr>
                  <td>${filtroVentas === "dia" ? new Date(s.fecha).toLocaleTimeString() : new Date(s.fecha).toLocaleString()}</td>
                  <td>${escapeHtml(s.metodoPago)}${s.pendiente ? `<br><strong style="color:#b45309;">&#9888; Pendiente: ${escapeHtml(s.cliente)} (debe $${(s.montoPendiente || 0).toFixed(2)})</strong>` : ""}</td>
                  <td>${escapeHtml(s.referencia) || "N/A"}</td>
                  <td>${s.items.length > 0 ? s.items.map((i: any) => `${i.qty}x ${escapeHtml(i.nombre)}`).join(", ") : "<em>Venta devuelta por completo</em>"}</td>
                  <td class="num">$${s.totalDolares.toFixed(2)}</td>
                  <td class="num">${fmtBs(s.totalBs)} BS</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="dev-box">
            <h3 style="margin: 0 0 8px 0; color: #b45309; font-size: 15px;">Resumen de Devoluciones del Periodo</h3>
            <p style="margin: 4px 0; font-size: 13px;">Cantidad de devoluciones/cambios: <strong>${devPeriodo.length}</strong></p>
            <p style="margin: 4px 0; font-size: 13px;">Monto total reembolsado: <strong>$${totalDevueltoDolar.toFixed(2)} (${fmtBs(totalDevueltoBs)} BS)</strong></p>
          </div>

          <div class="totales-box">
            <h3>Dinero cobrado por método (neto de reembolsos)</h3>
            <div class="totales-grid">
              <div><span>Efectivo (Bolívares):</span> <strong>${fmtBs(efectivoBs)} BS</strong></div>
              <div><span>Divisa (Dólares):</span> <strong>$${divisaDolar.toFixed(2)}</strong></div>
              <div><span>Pago Móvil (BS):</span> <strong>${fmtBs(pagoMovilBs)} BS</strong></div>
              <div><span>Transferencia (BS):</span> <strong>${fmtBs(transferenciaBs)} BS</strong></div>
            </div>
            <div class="total-final">
              <p>Total cobrado ($ equivalente): $${totalCobradoDolar.toFixed(2)}</p>
              <p>Reembolsos entregados en el periodo ($ equivalente): $${reembolsosDolar.toFixed(2)}</p>
              <p>Total Neto Vendido ($): $${totalDolarPeriodo.toFixed(2)}</p>
              <p>Total Neto Vendido (BS): ${fmtBs(totalBsPeriodo)} BS</p>
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
                      <p className="text-3xl font-black text-gray-900 mt-2">{sales.filter((s: any) => !s.devuelta).length}</p>
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
                  <p className="text-xs text-gray-500 mt-0.5">Filtra las ventas y genera reportes imprimibles (el reporte sigue el filtro elegido).</p>
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
                            {sale.devuelta && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-gray-100 text-gray-700 rounded-lg">
                                <RotateCcw className="w-3.5 h-3.5" />
                                Devuelta
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">{new Date(sale.fecha).toLocaleString()} (ID: {sale.id.slice(0, 8)})</p>
                          {Array.isArray(sale.pagos) && sale.pagos.length > 1 && (
                            <p className="text-[11px] text-gray-500 mt-1">
                              {sale.pagos.map((p: any) => `${p.metodo}: ${fmtPago(p)}`).join(" · ")}
                            </p>
                          )}
                          {typeof sale.precioOriginalDolares === "number" && Math.abs(sale.precioOriginalDolares - sale.totalDolares) > 0.005 && (
                            <p className="text-[11px] text-emerald-700 font-bold mt-1">
                              Precio ajustado: original ${sale.precioOriginalDolares.toFixed(2)} → ${sale.totalDolares.toFixed(2)}
                            </p>
                          )}
                          {sale.vuelto && (
                            <p className="text-[11px] text-gray-500 mt-1">
                              {sale.vuelto.metodo === "Efectivo"
                                ? `Vuelto entregado en efectivo: ${fmtBs(sale.vuelto.bsBcv)} BS (≈ $${sale.vuelto.dolares.toFixed(2)})`
                                : `Vuelto entregado: $${sale.vuelto.dolares.toFixed(2)} (${fmtBs(sale.vuelto.bsBcv)} BS BCV / ${fmtBs(sale.vuelto.bsDivisa)} BS divisa)`}
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
                        {sale.items.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sale.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-xl text-xs">
                                <span className="font-bold text-gray-800">{item.qty}x {item.nombre}</span>
                                <span className="text-gray-600">${(item.pVenta * item.qty).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">Todos los productos de esta venta fueron devueltos.</p>
                        )}
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
                          {dev.liquidacion && dev.liquidacion.sentido === "cobrar" ? (
                            <p className="text-sm font-black text-emerald-700">
                              Cobrado al cliente: {dev.liquidacion.metodo === "Divisas" ? `$${dev.liquidacion.monto.toFixed(2)}` : `${fmtBs(dev.liquidacion.monto)} BS`}
                            </p>
                          ) : (
                            <p className="text-sm font-black text-amber-700">Reembolso: {fmtBs(dev.montoReembolsoBs || 0)} BS</p>
                          )}
                          <p className="text-xs text-gray-500 font-medium">Comisión: {dev.comision || "N/A"}</p>
                        </div>
                      </div>
                      <div className="text-xs space-y-1 text-gray-700">
                        <p><strong>Detalle:</strong> {dev.detalle}</p>
                        <p><strong>Producto devuelto:</strong> {dev.cantidadDevuelta ? `${dev.cantidadDevuelta}x ` : ""}{dev.productoDevuelto}</p>
                        {dev.tipo === "cambio" && <p><strong>Producto de cambio:</strong> {dev.cantidadNueva ? `${dev.cantidadNueva}x ` : ""}{dev.productoNuevo}</p>}
                        {typeof dev.diferenciaDolares === "number" && dev.tipo === "cambio" && (
                          <p>
                            <strong>Diferencia:</strong>{" "}
                            {Math.abs(dev.diferenciaDolares) <= TOLERANCIA
                              ? "Sin diferencia"
                              : dev.diferenciaDolares > 0
                                ? `El cliente debía pagar $${dev.diferenciaDolares.toFixed(2)}`
                                : `Se debía devolver al cliente $${Math.abs(dev.diferenciaDolares).toFixed(2)}`}
                          </p>
                        )}
                        {dev.liquidacion && (
                          <p>
                            <strong>{dev.liquidacion.sentido === "entregar" ? "Entregado al cliente:" : "Cobrado al cliente:"}</strong>{" "}
                            {dev.liquidacion.metodo === "Divisas" ? `$${dev.liquidacion.monto.toFixed(2)}` : `${fmtBs(dev.liquidacion.monto)} BS`} ({dev.liquidacion.metodo})
                          </p>
                        )}
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
                                  onClick={() => eliminarProducto(prod.id, prod.nombre)} 
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
                        {etiquetaTipoPago(p.tipo)} · {p.metodo} · {new Date(p.fecha).toLocaleDateString()}
                      </span>
                      <span className="font-bold">
                        {fmtPago(p)}
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
                      Equivale a ${abonoDolares.toFixed(2)} · Quedaría debiendo {fmtDolaresYBs(Math.max(0, ventaPendienteActual.montoPendiente - abonoDolares))}
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
                  ¿Con qué pagó los ${ventaPendienteActual.montoPendiente.toFixed(2)} ({fmtBs(ventaPendienteActual.montoPendiente * tasaBcvSegura)} BS) restantes?
                </p>
                <SelectorPagos
                  form={pagoFinal}
                  auto={autoFinal}
                  objetivoDolares={debeDolares}
                  objetivoBs={debeBs}
                  pagadoDolares={pagadoFinalDolares}
                  tasa={tasaBcvSegura}
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
                  <p className="text-xs text-gray-500">Selecciona la venta, el producto y la cantidad afectada</p>
                </div>
              </div>
              <button 
                onClick={cerrarModalDevolucion}
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

                {busquedaVentaDev.trim() !== "" && !ventaDev && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {sales.filter(s => 
                      s.items.length > 0 && (
                        s.id.toLowerCase().includes(busquedaVentaDev.toLowerCase()) || 
                        s.items.some((i: any) => i.nombre.toLowerCase().includes(busquedaVentaDev.toLowerCase()))
                      )
                    ).map(sale => (
                      <div key={sale.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <p className="font-bold text-gray-900 text-xs">Venta ID: {sale.id.slice(0, 10)} | Fecha: {new Date(sale.fecha).toLocaleString()}</p>
                          <p className="text-[11px] text-gray-500">{sale.items.map((i: any) => `${i.qty}x ${i.nombre}`).join(", ")}</p>
                        </div>
                        <Button 
                          onClick={() => { setVentaDevId(sale.id); setBusquedaVentaDev(""); setIndiceItemDev(null); setMontoLiqManual(""); }}
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

              {ventaDev && (
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-emerald-800">Venta: {ventaDev.id.slice(0, 10)}</span>
                      <p className="text-[11px] text-emerald-700 mt-0.5">Fecha de la venta: <strong>{new Date(ventaDev.fecha).toLocaleString()}</strong></p>
                      {ventaDev.pendiente && (
                        <p className="text-[11px] text-amber-700 font-bold mt-0.5">Esta venta tiene un pago pendiente de ${(ventaDev.montoPendiente || 0).toFixed(2)}</p>
                      )}
                    </div>
                    <button onClick={() => { setVentaDevId(null); setIndiceItemDev(null); setMontoLiqManual(""); }} className="text-xs text-red-600 font-bold hover:underline cursor-pointer">Cambiar venta</button>
                  </div>
                  <p className="text-xs font-bold text-gray-600 uppercase">2. Selecciona el producto que se devuelve (uno solo):</p>
                  <div className="space-y-2">
                    {ventaDev.items.map((item: any, idx: number) => (
                      <div 
                        key={idx} 
                        onClick={() => {
                          setIndiceItemDev(idx);
                          setCantidadDevolver("1");
                          setMontoLiqManual("");
                        }}
                        className={cn(
                          "p-3 rounded-xl border flex justify-between items-center cursor-pointer transition",
                          indiceItemDev === idx ? "bg-amber-600 text-white border-amber-600 font-bold" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        <span>{item.qty}x {item.nombre}</span>
                        <span>${(item.pVenta * item.qty).toFixed(2)} · {fmtBs(item.pFinalBs * item.qty)} BS</span>
                      </div>
                    ))}
                  </div>

                  {itemDev && (
                    <div className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 p-3">
                      <div>
                        <p className="text-xs font-bold text-gray-700">Unidades a devolver</p>
                        <p className="text-[11px] text-gray-500">
                          Compró {itemDev.qty} · ${itemDev.pVenta.toFixed(2)} c/u ({fmtBs(itemDev.pFinalBs)} BS)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => cambiarCantidadDevolver(-1)} className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-black text-gray-900">{qtyDevNum || 1}</span>
                        <button type="button" onClick={() => cambiarCantidadDevolver(1)} className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {itemDev && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">3. Tipo de Operación</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setTipoDevolucion("devolucion"); setMontoLiqManual(""); }}
                        className={cn("py-2.5 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center", tipoDevolucion === "devolucion" ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-white text-gray-700 border-gray-200")}
                      >
                        Devolución / Reembolso
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTipoDevolucion("cambio"); setMontoLiqManual(""); }}
                        className={cn("py-2.5 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center", tipoDevolucion === "cambio" ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-white text-gray-700 border-gray-200")}
                      >
                        Cambio por otro producto
                      </button>
                    </div>
                  </div>

                  {tipoDevolucion === "cambio" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecciona el producto nuevo de reemplazo</label>
                        <select 
                          value={productoCambioId}
                          onChange={(e) => { setProductoCambioId(e.target.value); setCantidadCambio("1"); setMontoLiqManual(""); }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">-- Elige un producto del inventario --</option>
                          {[...products]
                            .filter((p) => p.cantidad > 0 || p.id === itemDev.id)
                            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} (Stock: {p.cantidad}) · ${calcularPrecios(p.pCompra).pVenta.toFixed(2)}
                              </option>
                            ))}
                        </select>
                      </div>
                      {productoCambio && (
                        <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl border border-gray-200 p-3">
                          <div>
                            <p className="text-xs font-bold text-gray-700">Unidades del producto nuevo</p>
                            <p className="text-[11px] text-gray-500">
                              ${calcularPrecios(productoCambio.pCompra).pVenta.toFixed(2)} c/u ({fmtBs(calcularPrecios(productoCambio.pCompra).pFinalBs)} BS)
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => cambiarCantidadCambio(-1)} className="p-1.5 border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center text-sm font-black text-gray-900">{qtyCambioNum || 1}</span>
                            <button type="button" onClick={() => cambiarCantidadCambio(1)} className="p-1.5 border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* RESUMEN: quién le debe a quién */}
                  {calcDev && (tipoDevolucion === "devolucion" || (productoCambio && qtyCambioNum > 0)) && (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between gap-3">
                          <span className="font-bold text-gray-500 uppercase">Producto que devuelve</span>
                          <span className="font-bold text-gray-800">${calcDev.valorDevueltoDolares.toFixed(2)} · {fmtBs(calcDev.valorDevueltoDolares * tasaBcvSegura)} BS</span>
                        </div>
                        {tipoDevolucion === "cambio" && (
                          <div className="flex justify-between gap-3">
                            <span className="font-bold text-gray-500 uppercase">Producto nuevo</span>
                            <span className="font-bold text-gray-800">${calcDev.valorNuevoDolares.toFixed(2)} · {fmtBs(calcDev.valorNuevoDolares * tasaBcvSegura)} BS</span>
                          </div>
                        )}
                      </div>

                      {saldoDev < -TOLERANCIA && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                          <p className="text-[11px] font-black text-red-700 uppercase">Debes dar dinero al cliente</p>
                          <p className="text-xl font-black text-red-700">${Math.abs(saldoDev).toFixed(2)}</p>
                          <p className="text-xs font-bold text-red-600">{fmtBs(Math.abs(saldoDev) * tasaBcvSegura)} BS (tasa BCV)</p>
                        </div>
                      )}
                      {saldoDev > TOLERANCIA && !esVentaPendienteDev && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                          <p className="text-[11px] font-black text-emerald-700 uppercase">El cliente debe pagarte la diferencia</p>
                          <p className="text-xl font-black text-emerald-700">${saldoDev.toFixed(2)}</p>
                          <p className="text-xs font-bold text-emerald-600">{fmtBs(saldoDev * tasaBcvSegura)} BS (tasa BCV)</p>
                        </div>
                      )}
                      {saldoDev > TOLERANCIA && esVentaPendienteDev && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                          <p className="text-[11px] font-black text-amber-700 uppercase">La venta quedará con este saldo pendiente</p>
                          <p className="text-xl font-black text-amber-700">${saldoDev.toFixed(2)}</p>
                          <p className="text-xs font-bold text-amber-600">{fmtBs(saldoDev * tasaBcvSegura)} BS (tasa BCV)</p>
                        </div>
                      )}
                      {Math.abs(saldoDev) <= TOLERANCIA && (
                        <div className="p-3 rounded-xl bg-gray-100 border border-gray-200 text-xs font-bold text-gray-600">
                          {esVentaPendienteDev && (ventaDev?.montoPendiente || 0) > TOLERANCIA
                            ? "La venta queda sin deuda pendiente. No hay dinero que mover."
                            : "Sin diferencia: no hay dinero que entregar ni cobrar."}
                        </div>
                      )}

                      {liquidaAhora && (
                        <div className="space-y-3 pt-1">
                          <p className="text-xs font-bold text-gray-600 uppercase">
                            {saldoDev < 0 ? "¿Con qué le entregas el dinero?" : "¿Con qué paga la diferencia?"}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {METODOS_PAGO.map((metodo) => (
                              <button
                                key={metodo}
                                type="button"
                                onClick={() => { setMetodoLiq(metodo); setMontoLiqManual(""); setRefLiq(""); }}
                                className={cn(
                                  "py-2 px-3 text-xs font-bold rounded-xl border transition text-center cursor-pointer",
                                  metodoLiq === metodo ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                )}
                              >
                                {metodo}
                              </button>
                            ))}
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                              Monto a {saldoDev < 0 ? "entregar" : "cobrar"} {metodoLiq === "Divisas" ? "($)" : "(BS)"}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={montoLiqManual}
                              onChange={(e) => setMontoLiqManual(e.target.value)}
                              placeholder={liqAutoMonto.toFixed(2)}
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <p className="text-[11px] text-gray-500 mt-1">
                              Sugerido: {metodoLiq === "Divisas" ? `$${liqAutoMonto.toFixed(2)}` : `${fmtBs(liqAutoMonto)} BS`}. Si aplicas una comisión, escribe el monto final que entregas.
                            </p>
                          </div>
                          {necesitaReferencia(metodoLiq) && (
                            <input
                              type="text"
                              maxLength={4}
                              value={refLiq}
                              onChange={(e) => setRefLiq(e.target.value.replace(/\D/g, ""))}
                              placeholder="Referencia: últimos 4 dígitos (Ej: 4829)"
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

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
              )}

              {errorDevolucion && itemDev && (
                <p className="text-xs font-bold text-amber-700 text-right">{errorDevolucion}</p>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={cerrarModalDevolucion}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <Button
                  onClick={procesarDevolucionOCambio}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm cursor-pointer"
                  disabled={!!errorDevolucion || guardandoDevolucionState}
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
                            <p className="text-xs font-mono font-bold text-gray-600">Código: {prod.codigo}</p>
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
                          <p className="text-[11px] font-mono font-bold text-gray-500">Código: {item.codigo}</p>
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
                <div className="flex justify-between items-center gap-3">
                  <span className="text-sm font-bold text-gray-600">Total Venta ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalEditado ? totalEditado.d : (carrito.length > 0 ? totalCarritoDolares.toFixed(2) : "")}
                    onChange={(e) => editarTotalDolares(e.target.value)}
                    disabled={carrito.length === 0}
                    placeholder={totalCarritoDolares.toFixed(2)}
                    className="w-40 px-3 py-1.5 rounded-lg border border-emerald-200 text-xl font-black text-right text-emerald-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  />
                </div>
                <div className="flex justify-between items-center gap-3 border-t border-emerald-100/60 pt-2">
                  <span className="text-sm font-bold text-gray-600">Total Venta (BS):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalEditado ? totalEditado.bs : (carrito.length > 0 ? totalCarritoBs.toFixed(2) : "")}
                    onChange={(e) => editarTotalBs(e.target.value)}
                    disabled={carrito.length === 0}
                    placeholder={totalCarritoBs.toFixed(2)}
                    className="w-40 px-3 py-1.5 rounded-lg border border-emerald-200 text-xl font-black text-right text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  />
                </div>
                {hayTotalEditado && (
                  <div className="flex justify-between items-center gap-3 text-[11px] font-bold text-gray-600 bg-white rounded-lg border border-emerald-100 px-3 py-2">
                    <span>
                      Precio original: ${totalCarritoDolares.toFixed(2)} · {fmtBs(totalCarritoBs)} BS
                      {" · "}
                      <span className={rebajaDolares >= 0 ? "text-emerald-700" : "text-amber-700"}>
                        {rebajaDolares >= 0 ? "Rebaja" : "Aumento"}: ${Math.abs(rebajaDolares).toFixed(2)} · {fmtBs(Math.abs(rebajaBs))} BS
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTotalEditado(null)}
                      className="text-red-600 hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Restablecer
                    </button>
                  </div>
                )}

                {/* Opciones especiales */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100/60">
                  <button
                    type="button"
                    disabled={!vueltoDisponible}
                    onClick={() => { setDarVuelto(!darVuelto); setMontoRecibido(""); }}
                    title={!vueltoDisponible ? "Selecciona el método Divisas o Efectivo (y que no sea pago pendiente) para dar vuelto" : ""}
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
                    <div className="flex justify-between gap-3 text-xs font-bold text-amber-900">
                      <span>Paga ahora: ${pagadoVentaDolares.toFixed(2)} ({fmtBs(pagadoVentaDolares * tasaBcv)} BS)</span>
                      <span className="text-right">Quedará pendiente: ${pendienteVentaDolares.toFixed(2)} ({fmtBs(pendienteVentaDolares * tasaBcv)} BS)</span>
                    </div>
                  </div>
                )}

                <SelectorPagos
                  form={pagoVenta}
                  auto={autoCompleto}
                  objetivoDolares={totalVentaDolares}
                  objetivoBs={totalVentaBs}
                  pagadoDolares={pagadoVentaDolares}
                  tasa={tasaBcvSegura}
                  ocultarMetodo={vueltoActivo ? metodoVueltoSel : null}
                />

                {vueltoActivo && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                    {metodosVuelto.length > 1 && (
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-blue-800 uppercase">Dar el vuelto sobre:</label>
                        <div className="grid grid-cols-2 gap-2">
                          {metodosVuelto.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => { setMetodoVuelto(m); setMontoRecibido(""); }}
                              className={cn(
                                "py-1.5 px-3 text-xs font-bold rounded-lg border transition cursor-pointer",
                                metodoVueltoSel === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-blue-200 hover:bg-blue-50"
                              )}
                            >
                              {m === "Divisas" ? "Divisas ($)" : "Efectivo (BS)"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs font-bold text-blue-900">
                      <span>A cubrir con {metodoVueltoSel === "Divisas" ? "divisa" : "efectivo"}:</span>
                      <span>
                        {metodoVueltoSel === "Divisas"
                          ? `$${restanteDolares.toFixed(2)}`
                          : `${fmtBs(restanteBsVuelto)} BS`}
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-800 uppercase mb-1">
                        {metodoVueltoSel === "Divisas" ? "Monto recibido en divisa ($)" : "Monto recibido en efectivo (BS)"}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        placeholder={metodoVueltoSel === "Divisas" ? "Ej: 100" : "Ej: 5000"}
                        className="w-full px-4 py-2.5 rounded-xl border border-blue-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {recibidoNum > 0 && recibidoDolares >= restanteDolares - TOLERANCIA && (
                      <div className="bg-white rounded-xl border border-blue-100 p-3 space-y-1.5">
                        {metodoVueltoSel === "Divisas" ? (
                          <>
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
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-600">Vuelto a dar (BS):</span>
                              <span className="text-lg font-black text-blue-700">{fmtBs(vueltoMetodo)} BS</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-600">Equivale a $ (tasa BCV {fmtBs(tasaBcv)}):</span>
                              <span className="font-black text-gray-900">${vueltoDolares.toFixed(2)}</span>
                            </div>
                          </>
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
