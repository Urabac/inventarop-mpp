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
  RotateCcw
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
  const [tasaBcv, setTasaBcv] = useState<number>(877.90);
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [tempTasa, setTempTasa] = useState(tasaBcv.toString());
  const [cargandoBcv, setCargandoBcv] = useState(false);

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

  const [modalVentaOpen, setModalVentaOpen] = useState(false);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [filtroVentas, setFiltroVentas] = useState("dia");

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

    return () => {
      unsubProducts();
      unsubSales();
      unsubDev();
      unsubTasa();
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

  const eliminarVenta = async (id: string) => {
    try {
      await deleteDoc(doc(db, COLLECTION_VENTAS, id));
    } catch (e: any) {
      console.error("Error eliminando venta:", e);
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

  const confirmarVenta = async () => {
    if (carrito.length === 0 || guardandoVenta) return;
    if ((metodoPago === "Pago movil" || metodoPago === "Transferencia") && referenciaPago.length !== 4) return;

    setGuardandoVenta(true);
    try {
      for (let item of carrito) {
        const prodActual = products.find(p => p.id === item.id);
        if (prodActual) {
          const nuevaCant = Math.max(0, prodActual.cantidad - item.qty);
          await updateDoc(doc(db, COLLECTION_INVENTARIO, item.id), { cantidad: nuevaCant });
        }
      }

      const nuevaVenta = {
        fecha: new Date().toISOString(),
        items: [...carrito],
        totalDolares: totalVentaDolares,
        totalBs: totalVentaBs,
        metodoPago,
        referencia: (metodoPago === "Pago movil" || metodoPago === "Transferencia") ? referenciaPago : ""
      };

      await addDoc(collection(db, COLLECTION_VENTAS), nuevaVenta);

      setCarrito([]);
      setMetodoPago("Efectivo");
      setReferenciaPago("");
      setModalVentaOpen(false);
    } catch (e: any) {
      console.error("Error al procesar la venta en Firebase:", e);
    } finally {
      setTimeout(() => setGuardandoVenta(false), 2000);
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

    let efectivoBs = 0;
    let divisaDolar = 0;
    let pagoMovilBs = 0;
    let transferenciaBs = 0;

    ventasDelDia.forEach(s => {
      if (s.metodoPago === "Efectivo") efectivoBs += s.totalBs;
      else if (s.metodoPago === "Divisas") divisaDolar += s.totalDolares;
      else if (s.metodoPago === "Pago movil") pagoMovilBs += s.totalBs;
      else if (s.metodoPago === "Transferencia") transferenciaBs += s.totalBs;
    });

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
            @media print { .print-btn { display: none; } }
          </style>
        </head>
        <body>
          <h2>MOTO PARTES PIRUETA</h2>
          <p class="subtitle">Reporte Diario de Ventas (Neto con Devoluciones)</p>
          <div class="info">
            <strong>Fecha del reporte:</strong> ${new Date().toLocaleDateString()} <br>
            <strong>Tasa BCV aplicada:</strong> ${tasaBcv.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS
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
                  <td>${s.metodoPago}</td>
                  <td>${s.referencia || "N/A"}</td>
                  <td>${s.items.map((i: any) => `${i.qty}x ${i.nombre}`).join(", ")}</td>
                  <td class="num">$${s.totalDolares.toFixed(2)}</td>
                  <td class="num">${s.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div style="margin-top: 25px; padding: 15px; border: 1px solid #f59e0b; background: #fffbeb; border-radius: 8px;">
            <h3 style="margin: 0 0 8px 0; color: #b45309; font-size: 15px;">Resumen de Devoluciones del Día</h3>
            <p style="margin: 4px 0; font-size: 13px;">Cantidad de devoluciones/cambios: <strong>${devDelDia.length}</strong></p>
            <p style="margin: 4px 0; font-size: 13px;">Monto total devuelto: <strong>$${totalDevueltoDolar.toFixed(2)} (${totalDevueltoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS)</strong></p>
          </div>

          <div class="totales-box">
            <h3>Cierre Neto del Día (Menos Devoluciones)</h3>
            <div class="totales-grid">
              <div><span>Efectivo (Bolívares):</span> <strong>${efectivoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</strong></div>
              <div><span>Divisa (Dólares):</span> <strong>$${divisaDolar.toFixed(2)}</strong></div>
              <div><span>Pago Móvil (BS):</span> <strong>${pagoMovilBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</strong></div>
              <div><span>Transferencia (BS):</span> <strong>${transferenciaBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</strong></div>
            </div>
            <div class="total-final">
              <p>Total Neto del Día ($): $${totalDolarDia.toFixed(2)}</p>
              <p>Total Neto del Día (BS): ${totalBsDia.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</p>
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
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer",
                currentSection === "inicio" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <LayoutDashboard className="w-5 h-5" />
              Inicio
            </button>
            <button
              onClick={() => setCurrentSection("ventas")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer",
                currentSection === "ventas" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <CreditCard className="w-5 h-5" />
              Ventas
            </button>
            <button
              onClick={() => setCurrentSection("devoluciones")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer",
                currentSection === "devoluciones" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <RotateCcw className="w-5 h-5" />
              Devoluciones
            </button>
            <button
              onClick={() => setCurrentSection("inventario")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer",
                currentSection === "inventario" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100"
              )}
            >
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
          <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Moto Partes Pirueta
              </span>
              <h2 className="text-3xl font-black mt-2">
                {currentSection === "inicio" && "Panel Principal"}
                {currentSection === "ventas" && "Módulo de Ventas"}
                {currentSection === "devoluciones" && "Módulo de Devoluciones y Cambios"}
                {currentSection === "inventario" && "Módulo de Inventario"}
              </h2>
              <p className="text-emerald-100 text-sm mt-1">
                Control seguro en la nube.
              </p>
            </div>

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
                      {tasaBcv.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS
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
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                          <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
                            Pago: {sale.metodoPago} {sale.referencia ? `(Ref: ${sale.referencia})` : ""}
                          </span>
                          <p className="text-xs text-gray-400 mt-2">{new Date(sale.fecha).toLocaleString()} (ID: {sale.id.slice(0, 8)})</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-black text-emerald-600">${sale.totalDolares.toFixed(2)}</p>
                            <p className="text-xs font-bold text-gray-500">{sale.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</p>
                          </div>
                          <button 
                            onClick={() => eliminarVenta(sale.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                            title="Eliminar venta del historial"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
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
                          <p className="text-sm font-black text-amber-700">Reembolso: {(dev.montoReembolsoBs || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</p>
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
                  <p className="text-xs text-gray-500 mt-0.5">Los precios de venta y bolívares se calculan con base en la Tasa BCV ({tasaBcv.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS).</p>
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
                              <td className="py-4 px-6 text-right font-black text-gray-900">{calc.pFinalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</td>
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
                        <span>{(item.pFinalBs * item.qty).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</span>
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
                            <p className="text-xs text-gray-500">Stock: {prod.cantidad} | Venta: ${calc.pVenta} ({calc.pFinalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS)</p>
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
                          <p className="text-xs text-gray-500">${item.pVenta} c/u ({item.pFinalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS)</p>
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
                  <span className="text-xl font-black text-gray-900">{totalVentaBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</span>
                </div>

                <div className="space-y-2 pt-2 border-t border-emerald-100/60">
                  <label className="block text-xs font-bold text-gray-600 uppercase">Método de Pago</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["Efectivo", "Divisas", "Pago movil", "Transferencia"].map(metodo => (
                      <button
                        key={metodo}
                        type="button"
                        onClick={() => setMetodoPago(metodo)}
                        className={cn(
                          "py-2 px-3 text-xs font-bold rounded-xl border transition text-center cursor-pointer",
                          metodoPago === metodo ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        {metodo}
                      </button>
                    ))}
                  </div>
                </div>

                {(metodoPago === "Pago movil" || metodoPago === "Transferencia") && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Referencia (Últimos 4 dígitos)</label>
                    <input 
                      type="text" 
                      maxLength={4}
                      value={referenciaPago}
                      onChange={(e) => setReferenciaPago(e.target.value.replace(/\D/g, ""))}
                      placeholder="Ej: 4829"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                )}
              </div>

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
                  disabled={carrito.length === 0 || guardandoVenta}
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
                    <span className="font-black text-gray-900">{calcularPrecios(parseFloat(formPCompra)).pFinalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BS</span>
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
