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
  AlertCircle
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

export function FinancialDashboard(props: any) {
  const [user, setUser] = useState<any>(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [errorLogin, setErrorLogin] = useState("");

  const [currentSection, setCurrentSection] = useState("inicio");
  
  // TASA BCV
  const [tasaBcv, setTasaBcv] = useState<number>(877.90);
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [tempTasa, setTempTasa] = useState(tasaBcv.toString());
  const [cargandoBcv, setCargandoBcv] = useState(false);

  // TASA DIVISA
  const [tasaDivisa, setTasaDivisa] = useState<number>(900.00);
  const [editandoTasaDivisa, setEditandoTasaDivisa] = useState(false);
  const [tempTasaDivisa, setTempTasaDivisa] = useState(tasaDivisa.toString());

  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [devoluciones, setDevoluciones] = useState<any[]>([]);

  const [busquedaInventario, setBusquedaInventario] = useState("");
  const [modalStockBajoOpen, setModalStockBajoOpen] = useState(false);
  const [modalPagosPendientesOpen, setModalPagosPendientesOpen] = useState(false);

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

  const [modalVentaOpen, setModalVentaOpen] = useState(false);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [filtroVentas, setFiltroVentas] = useState("dia");

  // Opciones avanzadas de Venta
  const [darVuelto, setDarVuelto] = useState(false);
  const [montoRecibidoDivisa, setMontoRecibidoDivisa] = useState("");
  
  const [pagoPendienteCheck, setPagoPendienteCheck] = useState(false);
  const [nombreClienteDeuda, setNombreClienteDeuda] = useState("");
  const [montoAbonadoDeuda, setMontoAbonadoDeuda] = useState("");

  // Múltiples Métodos de Pago
  const [metodosMultiples, setMetodosMultiples] = useState<{ [key: string]: { activo: boolean; monto: string; referencia: string } }>({
    "Efectivo": { activo: true, monto: "", referencia: "" },
    "Divisas": { activo: false, monto: "", referencia: "" },
    "Pago movil": { activo: false, monto: "", referencia: "" },
    "Transferencia": { activo: false, monto: "", referencia: "" }
  });

  // Modal Gestión de Pago Pendiente Seleccionado
  const [ventaGestionPendiente, setVentaGestionPendiente] = useState<any>(null);
  const [tipoGestion, setTipoGestion] = useState<"abonar" | "finalizar">("abonar");
  const [montoAccionPendiente, setMontoAccionPendiente] = useState("");
  const [metodoFinalizacion, setMetodoFinalizacion] = useState("Efectivo");
  const [refFinalizacion, setRefFinalizacion] = useState("");

  // Cooldown States
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
          await setDoc(doc(db, COLLECTION_CONFIG, "general"), { bcv: valorOficial, divisa: tasaDivisa }, { merge: true });
          setCargandoBcv(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Fallo primera fuente BCV", e);
    } fontally {
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

    const unsubConfig = onSnapshot(doc(db, COLLECTION_CONFIG, "general"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.bcv) { setTasaBcv(data.bcv); setTempTasa(data.bcv.toString()); }
        if (data.divisa) { setTasaDivisa(data.divisa); setTempTasaDivisa(data.divisa.toString()); }
      }
    });

    return () => {
      unsubProducts();
      unsubSales();
      unsubDev();
      unsubConfig();
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

  const guardarTasaBcv = async () => {
    const val = parseFloat(tempTasa);
    if (!isNaN(val) && val > 0) {
      setTasaBcv(val);
      setEditandoTasa(false);
      await setDoc(doc(db, COLLECTION_CONFIG, "general"), { bcv: val, divisa: tasaDivisa }, { merge: true });
    }
  };

  const guardarTasaDivisa = async () => {
    const val = parseFloat(tempTasaDivisa);
    if (!isNaN(val) && val > 0) {
      setTasaDivisa(val);
      setEditandoTasaDivisa(false);
      await setDoc(doc(db, COLLECTION_CONFIG, "general"), { bcv: tasaBcv, divisa: val }, { merge: true });
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
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => setGuardandoProductoState(false), 2000);
    }
  };

  const eliminarProducto = async (id: string) => {
    try {
      await deleteDoc(doc(db, COLLECTION_INVENTARIO, id));
    } catch (e) {
      console.error(e);
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

  // Cálculos de Vuelto
  const recibidoDivisaNum = parseFloat(montoRecibidoDivisa) || 0;
  const vueltoDolares = Math.max(0, recibidoDivisaNum - totalVentaDolares);
  const vueltoBsBcv = vueltoDolares * tasaBcv;
  const vueltoBsDivisa = vueltoDolares * tasaDivisa;

  const confirmarVenta = async () => {
    if (carrito.length === 0 || guardandoVenta) return;

    setGuardandoVenta(true);
    try {
      for (let item of carrito) {
        const prodActual = products.find(p => p.id === item.id);
        if (prodActual) {
          const nuevaCant = Math.max(0, prodActual.cantidad - item.qty);
          await updateDoc(doc(db, COLLECTION_INVENTARIO, item.id), { cantidad: nuevaCant });
        }
      }

      let pagosRegistrados: any = {};
      Object.keys(metodosMultiples).forEach(metodo => {
        if (metodosMultiples[metodo].activo) {
          pagosRegistrados[metodo] = parseFloat(metodosMultiples[metodo].monto) || 0;
        }
      });

      const abonadoNum = parseFloat(montoAbonadoDeuda) || 0;
      const pendienteMonto = pagoPendienteCheck ? Math.max(0, totalVentaDolares - abonadoNum) : 0;

      const nuevaVenta = {
        fecha: new Date().toISOString(),
        items: [...carrito],
        totalDolares: totalVentaDolares,
        totalBs: totalVentaBs,
        pagosMultiples: pagosRegistrados,
        esPagoPendiente: pagoPendienteCheck,
        nombreCliente: pagoPendienteCheck ? nombreClienteDeuda : "",
        montoPendiente: pendienteMonto,
        abonadoInicial: abonadoNum,
        estadoDeuda: pagoPendienteCheck ? "pendiente" : "completado"
      };

      await addDoc(collection(db, COLLECTION_VENTAS), nuevaVenta);

      setCarrito([]);
      setDarVuelto(false);
      setMontoRecibidoDivisa("");
      setPagoPendienteCheck(false);
      setNombreClienteDeuda("");
      setMontoAbonadoDeuda("");
      setModalVentaOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setGuardandoVenta(false), 2000);
    }
  };

  const procesarGestionPendiente = async () => {
    if (!ventaGestionPendiente) return;

    try {
      if (tipoGestion === "abonar") {
        const abonoExtra = parseFloat(montoAccionPendiente) || 0;
        const nuevoPendiente = Math.max(0, ventaGestionPendiente.montoPendiente - abonoExtra);
        const nuevoEstado = nuevoPendiente === 0 ? "completado" : "pendiente";

        await updateDoc(doc(db, COLLECTION_VENTAS, ventaGestionPendiente.id), {
          montoPendiente: nuevoPendiente,
          estadoDeuda: nuevoEstado,
          esPagoPendiente: nuevoEstado === "pendiente"
        });
      } else {
        await updateDoc(doc(db, COLLECTION_VENTAS, ventaGestionPendiente.id), {
          montoPendiente: 0,
          estadoDeuda: "completado",
          esPagoPendiente: false,
          metodoPagoFinal: metodoFinalizacion,
          referenciaFinal: refFinalizacion
        });
      }
      setVentaGestionPendiente(null);
      setMontoAccionPendiente("");
      setRefFinalizacion("");
    } catch (e) {
      console.error(e);
    }
  };

  const ventasPendientesLista = sales.filter((s: any) => s.esPagoPendiente && s.estadoDeuda === "pendiente");

  const procesarDevolucionOCambio = async () => {
    if (!ventaSeleccionadaDev || !productoDevueltoItem || guardandoDevolucionState) return;
    setGuardandoDevolucionState(true);

    try {
      const prodInv = products.find(p => p.id === productoDevueltoItem.id);
      if (prodInv) {
        await updateDoc(doc(db, COLLECTION_INVENTARIO, productoDevueltoItem.id), { cantidad: prodInv.cantidad + productoDevueltoItem.qty });
      }

      let detalleOperacion = "";
      if (tipoDevolucion === "devolucion") {
        if (ventaSeleccionadaDev.items.length === 1) {
          await deleteDoc(doc(db, COLLECTION_VENTAS, ventaSeleccionadaDev.id));
          detalleOperacion = "Devolución total";
        } else {
          const nuevosItems = ventaSeleccionadaDev.items.filter((i: any) => i.id !== productoDevueltoItem.id);
          const nuevoTotalDolar = nuevosItems.reduce((acc: number, i: any) => acc + (i.pVenta * i.qty), 0);
          const nuevoTotalBs = nuevosItems.reduce((acc: number, i: any) => acc + (i.pFinalBs * i.qty), 0);
          await updateDoc(doc(db, COLLECTION_VENTAS, ventaSeleccionadaDev.id), { items: nuevosItems, totalDolares: nuevoTotalDolar, totalBs: nuevoTotalBs });
          detalleOperacion = "Devolución parcial";
        }
      } else {
        if (!productoCambioSeleccionado) { setGuardandoDevolucionState(false); return; }
        const prodNuevoInv = products.find(p => p.id === productoCambioSeleccionado.id);
        await updateDoc(doc(db, COLLECTION_INVENTARIO, productoCambioSeleccionado.id), { cantidad: prodNuevoInv.cantidad - 1 });
        const calcNuevo = calcularPrecios(productoCambioSeleccionado.pCompra);
        const itemNuevoObj = { ...productoCambioSeleccionado, pVenta: calcNuevo.pVenta, pFinalBs: calcNuevo.pFinalBs, qty: 1 };
        const otrosItems = ventaSeleccionadaDev.items.filter((i: any) => i.id !== productoDevueltoItem.id);
        const itemsActualizados = [...otrosItems, itemNuevoObj];
        const nuevoTotalDolar = itemsActualizados.reduce((acc: number, i: any) => acc + (i.pVenta * i.qty), 0);
        const nuevoTotalBs = itemsActualizados.reduce((acc: number, i: any) => acc + (i.pFinalBs * i.qty), 0);
        await updateDoc(doc(db, COLLECTION_VENTAS, ventaSeleccionadaDev.id), { items: itemsActualizados, totalDolares: nuevoTotalDolar, totalBs: nuevoTotalBs });
        detalleOperacion = `Cambio de ${productoDevueltoItem.nombre} por ${productoCambioSeleccionado.nombre}`;
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
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setGuardandoDevolucionState(false), 2000);
    }
  };

  const ventasFiltradas = sales.filter((sale: any) => {
    const fechaVenta = new Date(sale.fecha);
    const ahora = new Date();
    if (filtroVentas === "dia") return fechaVenta.toDateString() === ahora.toDateString();
    if (filtroVentas === "semana") {
      const unaSemanaAtras = new Date();
      unaSemanaAtras.setDate(ahora.getDate() - 7);
      return fechaVenta >= unaSemanaAtras;
    }
    if (filtroVentas === "mes") return fechaVenta.getMonth() === ahora.getMonth() && fechaVenta.getFullYear() === ahora.getFullYear();
    return true;
  });

  const productosFiltradosInventario = products
    .filter(p => p.nombre.toLowerCase().includes(busquedaInventario.toLowerCase()) || p.codigo.toLowerCase().includes(busquedaInventario.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const totalProductosRegistrados = products.length;
  const productosStockBajo = products
    .filter(p => Number(p.cantidad) <= 5)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const generarReportePDF = () => {
    const hoyStr = new Date().toDateString();
    const ventasDelDia = sales.filter((sale: any) => new Date(sale.fecha).toDateString() === hoyStr);
    const devDelDia = devoluciones.filter((dev: any) => new Date(dev.fecha).toDateString() === hoyStr);

    let totalDolarDia = ventasDelDia.reduce((acc, s) => acc + s.totalDolares, 0);
    let totalBsDia = ventasDelDia.reduce((acc, s) => acc + s.totalBs, 0);
    let totalDevueltoBs = devDelDia.reduce((acc, d) => acc + (d.montoReembolsoBs || 0), 0);
    let totalDevueltoDolar = totalDevueltoBs / (tasaBcv > 0 ? tasaBcv : 1);

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
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; }
            td.num, th.num { text-align: right; }
          </style>
        </head>
        <body>
          <h2>MOTO PARTES PIRUETA</h2>
          <p style="text-align:center;">Reporte Diario Neto (Tasa BCV: ${tasaBcv} BS | Tasa Divisa: ${tasaDivisa} BS)</p>
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Cliente / Detalle</th>
                <th class="num">Total ($)</th>
                <th class="num">Total (BS)</th>
              </tr>
            </thead>
            <tbody>
              ${ventasDelDia.map(s => `
                <tr>
                  <td>${new Date(s.fecha).toLocaleTimeString()}</td>
                  <td>${s.nombreCliente ? `Deuda: ${s.nombreCliente}` : "Venta Normal"} - ${s.items.map((i: any) => `${i.qty}x ${i.nombre}`).join(", ")}</td>
                  <td class="num">$${s.totalDolares.toFixed(2)}</td>
                  <td class="num">${s.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <h3>Total Neto del Día: $${totalDolarDia.toFixed(2)} (${totalBsDia.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS)</h3>
          <button onclick="window.print()" style="margin-top:20px; padding:10px 20px; background:#047857; color:white; border:none; border-radius:5px; cursor:pointer;">Imprimir Reporte</button>
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
              <input 
                type="email" 
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="admin@motopartes.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md cursor-pointer">
              Iniciar Sesión en el Sistema
            </Button>
          </form>
        </div>
      </div>
    );
  }
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
            <button
              onClick={() => setCurrentSection("inicio")}
              className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer", currentSection === "inicio" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100")}
            >
              <LayoutDashboard className="w-5 h-5" /> Inicio
            </button>
            <button
              onClick={() => setCurrentSection("ventas")}
              className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer", currentSection === "ventas" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100")}
            >
              <CreditCard className="w-5 h-5" /> Ventas
            </button>
            <button
              onClick={() => setCurrentSection("devoluciones")}
              className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer", currentSection === "devoluciones" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100")}
            >
              <RotateCcw className="w-5 h-5" /> Devoluciones
            </button>
            <button
              onClick={() => setCurrentSection("inventario")}
              className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer", currentSection === "inventario" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100")}
            >
              <Package className="w-5 h-5" /> Inventario
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="px-4 py-2 mb-2 text-xs text-gray-500 truncate">{user?.email || "Administrador"}</div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition cursor-pointer">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Moto Partes Pirueta</span>
              <h2 className="text-3xl font-black mt-2">
                {currentSection === "inicio" && "Panel Principal"}
                {currentSection === "ventas" && "Módulo de Ventas"}
                {currentSection === "devoluciones" && "Módulo de Devoluciones y Cambios"}
                {currentSection === "inventario" && "Módulo de Inventario"}
              </h2>
            </div>

            {/* SECCIONES DE TASA BCV Y TASA DIVISA */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Tasa BCV */}
              <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-emerald-200" />
                <div>
                  <p className="text-[10px] text-emerald-100 font-bold uppercase">Dólar BCV:</p>
                  {editandoTasa ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input type="number" step="0.01" value={tempTasa} onChange={(e) => setTempTasa(e.target.value)} className="w-24 px-1.5 py-0.5 text-gray-900 text-xs rounded font-bold bg-white" />
                      <button onClick={guardarTasaBcv} className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded cursor-pointer">OK</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">{tasaBcv.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</span>
                      <button onClick={() => { setTempTasa(tasaBcv.toString()); setEditandoTasa(true); }} className="text-[10px] bg-white/20 hover:bg-white/35 text-white px-1.5 py-0.5 rounded cursor-pointer font-bold">Editar</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tasa Divisa */}
              <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-amber-200" />
                <div>
                  <p className="text-[10px] text-amber-100 font-bold uppercase">Tasa Divisa:</p>
                  {editandoTasaDivisa ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input type="number" step="0.01" value={tempTasaDivisa} onChange={(e) => setTempTasaDivisa(e.target.value)} className="w-24 px-1.5 py-0.5 text-gray-900 text-xs rounded font-bold bg-white" />
                      <button onClick={guardarTasaDivisa} className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded cursor-pointer">OK</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">{tasaDivisa.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</span>
                      <button onClick={() => { setTempTasaDivisa(tasaDivisa.toString()); setEditandoTasaDivisa(true); }} className="text-[10px] bg-white/20 hover:bg-white/35 text-white px-1.5 py-0.5 rounded cursor-pointer font-bold">Editar</button>
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
                  <button onClick={() => setModalVentaOpen(true)} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-500 transition text-left flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition"><ShoppingBag className="w-6 h-6" /></div>
                      <div><p className="font-bold text-gray-900">Nueva Venta</p><p className="text-xs text-gray-500">Registrar transacción</p></div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
                  </button>

                  <button onClick={() => setCurrentSection("devoluciones")} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-amber-500 transition text-left flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition"><RotateCcw className="w-6 h-6" /></div>
                      <div><p className="font-bold text-gray-900">Devoluciones</p><p className="text-xs text-gray-500">Gestionar cambios</p></div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-amber-500" />
                  </button>

                  <button onClick={() => setCurrentSection("inventario")} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-500 transition text-left flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition"><Package className="w-6 h-6" /></div>
                      <div><p className="font-bold text-gray-900">Inventario</p><p className="text-xs text-gray-500">Gestionar repuestos</p></div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Resumen general y Alertas</h3>
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* CARD PAGOS PENDIENTES */}
                  <div onClick={() => setModalPagosPendientesOpen(true)} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:border-orange-500 transition flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pagos Pendientes</p>
                      <p className="text-3xl font-black text-orange-600 mt-2">{ventasPendientesLista.length}</p>
                    </div>
                    <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl"><Clock className="w-7 h-7" /></div>
                  </div>

                  <div onClick={() => setModalStockBajoOpen(true)} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:border-amber-500 transition flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock bajo (≤ 5)</p>
                      <p className="text-3xl font-black text-amber-600 mt-2">{productosStockBajo.length}</p>
                    </div>
                    <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><AlertTriangle className="w-7 h-7" /></div>
                  </div>

                  <div onClick={() => setCurrentSection("ventas")} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:border-emerald-500 transition flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ventas registradas</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">{sales?.length || 0}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><CreditCard className="w-7 h-7" /></div>
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
                  <p className="text-xs text-gray-500 mt-0.5">Control estricto de transacciones.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={generarReportePDF} variant="outline" className="border-gray-300 text-gray-700 font-bold flex items-center gap-2 cursor-pointer">
                    <Printer className="w-4 h-4" /> Generar Reporte
                  </Button>
                  <Button onClick={() => setModalVentaOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 cursor-pointer">
                    <Plus className="w-4 h-4" /> Nueva Venta
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {sales.map((sale: any) => (
                  <div key={sale.id} className={cn("bg-white rounded-2xl border p-6 shadow-sm space-y-4 relative", sale.esPagoPendiente && sale.estadoDeuda === "pendiente" ? "border-orange-300 bg-orange-50/20" : "border-gray-200")}>
                    {sale.esPagoPendiente && sale.estadoDeuda === "pendiente" && (
                      <div className="absolute top-4 right-6 flex items-center gap-1.5 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
                        <AlertCircle className="w-4 h-4 animate-pulse" /> Pago Pendiente ({sale.nombreCliente})
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-2">
                      <div>
                        <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
                          {sale.esPagoPendiente ? `Deuda Cliente: ${sale.nombreCliente}` : `Estado: Completado`}
                        </span>
                        <p className="text-xs text-gray-400 mt-2">{new Date(sale.fecha).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-600">${sale.totalDolares.toFixed(2)}</p>
                        {sale.montoPendiente > 0 && <p className="text-xs font-bold text-orange-600">Pendiente: ${sale.montoPendiente.toFixed(2)}</p>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-gray-500 uppercase">Productos:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sale.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-xl text-xs font-medium">
                            <span>{item.qty}x {item.nombre}</span>
                            <span>${(item.pVenta * item.qty).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentSection === "devoluciones" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Control de Devoluciones y Cambios</h3>
                  <p className="text-xs text-gray-500">Gestión de retornos e inventario.</p>
                </div>
                <Button onClick={() => setModalDevolucionOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer">
                  <RotateCcw className="w-4 h-4 mr-2" /> Registrar Devolución
                </Button>
              </div>

              <div className="space-y-4">
                {devoluciones.map((dev: any) => (
                  <div key={dev.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg uppercase">{dev.tipo}</span>
                      <span className="text-xs font-black text-amber-700">Reembolso: {(dev.montoReembolsoBs || 0).toLocaleString("es-VE")} BS</span>
                    </div>
                    <p className="text-xs text-gray-700"><strong>Detalle:</strong> {dev.detalle} | <strong>Devuelto:</strong> {dev.productoDevuelto}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentSection === "inventario" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Inventario</h3>
                  <p className="text-xs text-gray-500">Gestión automática.</p>
                </div>
                <Button onClick={abrirModalNuevo} className="bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer">
                  <Plus className="w-4 h-4 mr-2" /> Agregar Producto
                </Button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <input 
                  type="text" 
                  value={busquedaInventario}
                  onChange={(e) => setBusquedaInventario(e.target.value)}
                  placeholder="Buscar repuesto..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-black text-gray-600 uppercase">
                      <th className="py-4 px-6">Código</th>
                      <th className="py-4 px-6">Nombre</th>
                      <th className="py-4 px-6 text-center">Cantidad</th>
                      <th className="py-4 px-6 text-right">P. Venta ($)</th>
                      <th className="py-4 px-6 text-right">P. Final (BS)</th>
                      <th className="py-4 px-6 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {productosFiltradosInventario.map((prod: any) => {
                      const calc = calcularPrecios(prod.pCompra);
                      return (
                        <tr key={prod.id} className="hover:bg-gray-50">
                          <td className="py-4 px-6 font-mono font-bold text-gray-700">{prod.codigo}</td>
                          <td className="py-4 px-6 font-bold text-gray-900">{prod.nombre}</td>
                          <td className="py-4 px-6 text-center"><span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">{prod.cantidad} un.</span></td>
                          <td className="py-4 px-6 text-right font-bold text-emerald-600">${calc.pVenta.toFixed(2)}</td>
                          <td className="py-4 px-6 text-right font-black text-gray-900">{calc.pFinalBs.toLocaleString("es-VE")} BS</td>
                          <td className="py-4 px-6 text-center flex justify-center gap-2">
                            <button onClick={() => abrirModalEditar(prod)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => eliminarProducto(prod.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL GESTIÓN DE PAGOS PENDIENTES */}
      {modalPagosPendientesOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-gray-900">Clientes con Pagos Pendientes</h3>
              <button onClick={() => setModalPagosPendientesOpen(false)} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              {ventasPendientesLista.length > 0 ? (
                ventasPendientesLista.map((v: any) => (
                  <div key={v.id} className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200 flex justify-between items-center">
                    <div>
                      <p className="font-black text-gray-900 text-sm">Cliente: {v.nombreCliente}</p>
                      <p className="text-xs text-gray-500">{v.items.map((i: any) => `${i.qty}x ${i.nombre}`).join(", ")}</p>
                      <p className="text-xs font-bold text-orange-600 mt-1">Monto pendiente: ${v.montoPendiente.toFixed(2)}</p>
                    </div>
                    <Button onClick={() => setVentaGestionPendiente(v)} size="sm" className="bg-orange-600 hover:bg-orange-700 text-white font-bold cursor-pointer">
                      Gestionar
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-center py-8 text-gray-400 text-xs">No hay pagos pendientes en este momento.</p>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setModalPagosPendientesOpen(false)} className="bg-gray-900 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer">Cerrar</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTERNO PARA ABONAR O FINALIZAR */}
      {ventaGestionPendiente && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-gray-900">Gestionar Deuda: {ventaGestionPendiente.nombreCliente}</h3>
            <p className="text-xs text-gray-500">Monto actual pendiente: <strong>${ventaGestionPendiente.montoPendiente.toFixed(2)}</strong></p>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTipoGestion("abonar")} className={cn("py-2 text-xs font-bold rounded-xl border cursor-pointer", tipoGestion === "abonar" ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-700")}>Abonar</button>
              <button onClick={() => setTipoGestion("finalizar")} className={cn("py-2 text-xs font-bold rounded-xl border cursor-pointer", tipoGestion === "finalizar" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700")}>Pago Finalizado</button>
            </div>

            {tipoGestion === "abonar" ? (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto a abonar ($)</label>
                <input type="number" step="0.01" value={montoAccionPendiente} onChange={(e) => setMontoAccionPendiente(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método de pago final</label>
                  <select value={metodoFinalizacion} onChange={(e) => setMetodoFinalizacion(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-white">
                    <option value="Efectivo">Efectivo</option>
                    <option value="Divisas">Divisas</option>
                    <option value="Pago movil">Pago móvil</option>
                    <option value="Transferencia">Transferencia</option>
                  </select>
                </div>
                {(metodoFinalizacion === "Pago movil" || metodoFinalizacion === "Transferencia") && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referencia (4 dígitos)</label>
                    <input type="text" maxLength={4} value={refFinalizacion} onChange={(e) => setRefFinalizacion(e.target.value)} placeholder="Ej: 1234" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold" />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setVentaGestionPendiente(null)} className="px-4 py-2 text-xs font-bold text-gray-600 cursor-pointer">Cancelar</button>
              <Button onClick={procesarGestionPendiente} className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl cursor-pointer">Guardar Cambios</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA VENTA CON MULTIPLES PAGOS Y VUELTO */}
      {modalVentaOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-gray-900">Registrar Nueva Venta</h3>
              <button onClick={() => setModalVentaOpen(false)} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar producto</label>
                <input 
                  type="text" 
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  placeholder="Nombre o código del repuesto..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium"
                />
                {busquedaProducto.trim() !== "" && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y">
                    {products.filter(p => p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())).map(prod => (
                      <div key={prod.id} className="p-2.5 flex justify-between items-center hover:bg-gray-50">
                        <span className="text-xs font-bold">{prod.nombre} (Stock: {prod.cantidad})</span>
                        <Button onClick={() => { agregarAlCarrito(prod); setBusquedaProducto(""); }} size="sm" className="bg-emerald-600 text-white text-xs cursor-pointer">Agregar</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase">Carrito de compra:</p>
                {carrito.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl text-xs">
                    <span className="font-bold">{item.qty}x {item.nombre}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => cambiarCantidadCarrito(item.id, -1)} className="px-1 font-bold">-</button>
                      <span>{item.qty}</span>
                      <button onClick={() => cambiarCantidadCarrito(item.id, 1)} className="px-1 font-bold">+</button>
                      <span className="font-bold text-emerald-600 ml-2">${(item.pVenta * item.qty).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border space-y-3">
                <div className="flex justify-between font-black text-sm">
                  <span>Total Venta:</span>
                  <span className="text-emerald-600">${totalVentaDolares.toFixed(2)} ({totalVentaBs.toLocaleString("es-VE")} BS)</span>
                </div>

                {/* OPCIÓN DAR VUELTO */}
                <div className="pt-2 border-t">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={darVuelto} onChange={(e) => setDarVuelto(e.target.checked)} />
                    Dar vuelto (Calcular efectivo recibido)
                  </label>
                  {darVuelto && (
                    <div className="mt-2 space-y-2">
                      <input type="number" step="0.01" value={montoRecibidoDivisa} onChange={(e) => setMontoRecibidoDivisa(e.target.value)} placeholder="Monto recibido en divisa ($)" className="w-full px-3 py-2 rounded-lg border text-xs font-bold bg-white" />
                      <div className="p-2 bg-emerald-100 rounded-lg text-xs font-bold text-emerald-900 space-y-1">
                        <p>Vuelto en $:${vueltoDolares.toFixed(2)}</p>
                        <p>Vuelto en BS (BCV): {vueltoBsBcv.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</p>
                        <p>Vuelto en BS (Tasa Divisa): {vueltoBsDivisa.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* OPCIÓN PAGO PENDIENTE */}
                <div className="pt-2 border-t">
                  <label className="flex items-center gap-2 text-xs font-bold text-orange-700 cursor-pointer">
                    <input type="checkbox" checked={pagoPendienteCheck} onChange={(e) => setPagoPendienteCheck(e.target.checked)} />
                    Registrar como Pago Pendiente (Fiado / Deuda)
                  </label>
                  {pagoPendienteCheck && (
                    <div className="mt-2 space-y-2">
                      <input type="text" value={nombreClienteDeuda} onChange={(e) => setNombreClienteDeuda(e.target.value)} placeholder="Nombre del cliente" className="w-full px-3 py-2 rounded-lg border text-xs font-bold bg-white" />
                      <input type="number" step="0.01" value={montoAbonadoDeuda} onChange={(e) => setMontoAbonadoDeuda(e.target.value)} placeholder="Monto abonado inicial ($)" className="w-full px-3 py-2 rounded-lg border text-xs font-bold bg-white" />
                    </div>
                  )}
                </div>

                {/* MÚLTIPLES MÉTODOS DE PAGO */}
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs font-bold text-gray-600 uppercase">Múltiples métodos de pago:</p>
                  {Object.keys(metodosMultiples).map(metodo => (
                    <div key={metodo} className="space-y-1 bg-white p-2 rounded-xl border">
                      <label className="flex items-center gap-2 text-xs font-bold">
                        <input type="checkbox" checked={metodosMultiples[metodo].activo} onChange={(e) => setMetodosMultiples({ ...metodosMultiples, [metodo]: { ...metodosMultiples[metodo], activo: e.target.checked } })} />
                        {metodo}
                      </label>
                      {metodosMultiples[metodo].activo && (
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <input type="number" step="0.01" value={metodosMultiples[metodo].monto} onChange={(e) => setMetodosMultiples({ ...metodosMultiples, [metodo]: { ...metodosMultiples[metodo], monto: e.target.value } })} placeholder="Monto ($)" className="px-2 py-1 text-xs border rounded" />
                          {(metodo === "Pago movil" || metodo === "Transferencia") && (
                            <input type="text" maxLength={4} value={metodosMultiples[metodo].referencia} onChange={(e) => setMetodosMultiples({ ...metodosMultiples, [metodo]: { ...metodosMultiples[metodo], referencia: e.target.value } })} placeholder="Ref (4 dígitos)" className="px-2 py-1 text-xs border rounded" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setModalVentaOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-600 cursor-pointer">Cancelar</button>
                <Button onClick={confirmarVenta} className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer" disabled={carrito.length === 0 || guardandoVenta}>
                  {guardandoVenta ? "Guardando..." : "Confirmar Venta"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL STOCK BAJO */}
      {modalStockBajoOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-gray-900">Productos con Stock Bajo</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {productosStockBajo.map((p: any) => (
                <div key={p.id} className="p-3 bg-amber-50 rounded-xl flex justify-between items-center text-xs font-bold">
                  <span>{p.nombre}</span>
                  <span className="text-amber-700">{p.cantidad} un.</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setModalStockBajoOpen(false)} className="bg-gray-900 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer">Cerrar</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO / EDITAR PRODUCTO */}
      {modalProductoOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-black text-gray-900 mb-4">{editandoId ? "Editar Producto" : "Nuevo Producto"}</h3>
            <form onSubmit={guardarProducto} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código</label>
                <input type="text" value={formCodigo} onChange={(e) => setFormCodigo(e.target.value)} placeholder="Ej: MP-001" className="w-full px-4 py-2.5 rounded-xl border text-sm font-bold" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Bujía" className="w-full px-4 py-2.5 rounded-xl border text-sm font-bold" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cantidad</label>
                  <input type="number" value={formCantidad} onChange={(e) => setFormCantidad(e.target.value)} placeholder="10" className="w-full px-4 py-2.5 rounded-xl border text-sm font-bold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">P. Compra ($)</label>
                  <input type="number" step="0.01" value={formPCompra} onChange={(e) => setFormPCompra(e.target.value)} placeholder="0.67" className="w-full px-4 py-2.5 rounded-xl border text-sm font-bold" required />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setModalProductoOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-600 cursor-pointer">Cancelar</button>
                <button type="submit" disabled={guardandoProductoState} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white cursor-pointer">
                  {guardandoProductoState ? "Guardando..." : "Guardar Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEVOLUCIONES */}
      {modalDevolucionOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-gray-900">Registrar Devolución o Cambio</h3>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar venta</label>
              <input type="text" value={busquedaVentaDev} onChange={(e) => setBusquedaVentaDev(e.target.value)} placeholder="ID o repuesto..." className="w-full px-4 py-2.5 rounded-xl border text-sm" />
              {busquedaVentaDev.trim() !== "" && !ventaSeleccionadaDev && (
                <div className="mt-2 bg-white border rounded-xl shadow max-h-40 overflow-y-auto divide-y">
                  {sales.filter(s => s.items.some((i: any) => i.nombre.toLowerCase().includes(busquedaVentaDev.toLowerCase()))).map(sale => (
                    <div key={sale.id} className="p-2.5 flex justify-between items-center text-xs">
                      <span>Venta ID: {sale.id.slice(0, 8)} (${sale.totalDolares.toFixed(2)})</span>
                      <Button onClick={() => setVentaSeleccionadaDev(sale)} size="sm" className="bg-amber-600 text-white">Seleccionar</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {ventaSeleccionadaDev && (
              <div className="p-3 bg-gray-50 rounded-xl space-y-2">
                <p className="text-xs font-bold">Selecciona producto devuelto:</p>
                {ventaSeleccionadaDev.items.map((i: any, idx: number) => (
                  <div key={idx} onClick={() => { setProductoDevueltoItem(i); setMontoReembolso((i.pFinalBs * i.qty).toFixed(2)); }} className={cn("p-2 rounded-lg border text-xs cursor-pointer", productoDevueltoItem?.id === i.id ? "bg-amber-600 text-white" : "bg-white")}>
                    {i.qty}x {i.nombre} - {(i.pFinalBs * i.qty).toLocaleString("es-VE")} BS
                  </div>
                ))}
              </div>
            )}

            {productoDevueltoItem && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setTipoDevolucion("devolucion")} className={cn("py-2 text-xs font-bold rounded-xl border", tipoDevolucion === "devolucion" ? "bg-amber-600 text-white" : "bg-white")}>Reembolso</button>
                  <button onClick={() => setTipoDevolucion("cambio")} className={cn("py-2 text-xs font-bold rounded-xl border", tipoDevolucion === "cambio" ? "bg-amber-600 text-white" : "bg-white")}>Cambio</button>
                </div>
                {tipoDevolucion === "cambio" && (
                  <select onChange={(e) => setProductoCambioSeleccionado(products.find(p => p.id === e.target.value))} className="w-full px-3 py-2 border rounded-xl text-xs font-bold">
                    <option value="">-- Elige producto de cambio --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.cantidad})</option>)}
                  </select>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto a devolver (BS)</label>
                  <input type="number" step="0.01" value={montoReembolso} onChange={(e) => setMontoReembolso(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Comisión / Nota</label>
                  <input type="text" value={comisionDevolucion} onChange={(e) => setComisionDevolucion(e.target.value)} placeholder="Ej: 5%" className="w-full px-3 py-2 border rounded-xl text-xs font-bold" />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setModalDevolucionOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-600">Cancelar</button>
              <Button onClick={procesarDevolucionOCambio} className="bg-amber-600 text-white font-bold px-5 py-2 rounded-xl cursor-pointer" disabled={!ventaSeleccionadaDev || !productoDevueltoItem || guardandoDevolucionState}>
                {guardandoDevolucionState ? "Procesando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
