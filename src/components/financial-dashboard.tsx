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
  ArrowRightLeft
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
      alert("Hubo un error al guardar en la base de datos: " + error.message);
    }
  };

  const eliminarProducto = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este producto de la base de datos?")) {
      try {
        await deleteDoc(doc(db, COLLECTION_INVENTARIO, id));
      } catch (e: any) {
        console.error("Error eliminando:", e);
        alert("No se pudo eliminar: " + e.message);
      }
    }
  };

  const eliminarVenta = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta venta del historial?")) {
      try {
        await deleteDoc(doc(db, COLLECTION_VENTAS, id));
      } catch (e: any) {
        console.error("Error eliminando venta:", e);
        alert("No se pudo eliminar la venta: " + e.message);
      }
    }
  };

  const agregarAlCarrito = (prod: any) => {
    const productoInventario = products.find(p => p.id === prod.id);
    const stockDisponible = productoInventario ? productoInventario.cantidad : 0;

    const calc = calcularPrecios(prod.pCompra);
    const itemExistente = carrito.find(item => item.id === prod.id);
    const cantidadActualEnCarrito = itemExistente ? itemExistente.qty : 0;

    if (cantidadActualEnCarrito + 1 > stockDisponible) {
      alert(`No puedes agregar más unidades. Stock disponible: ${stockDisponible}`);
      return;
    }

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
        if (delta > 0 && nuevaQty > stockDisponible) {
          alert(`Stock insuficiente. Solo quedan ${stockDisponible} unidades disponibles.`);
          return item;
        }
        return nuevaQty > 0 ? { ...item, qty: nuevaQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const totalVentaDolares = carrito.reduce((sum, item) => sum + (item.pVenta * item.qty), 0);
  const totalVentaBs = carrito.reduce((sum, item) => sum + (item.pFinalBs * item.qty), 0);

  const confirmarVenta = async () => {
    if (carrito.length === 0) {
      alert("El carrito está vacío.");
      return;
    }
    if ((metodoPago === "Pago movil" || metodoPago === "Transferencia") && referenciaPago.length !== 4) {
      alert("Por favor ingresa un número de referencia válido de exactamente 4 dígitos.");
      return;
    }

    for (let item of carrito) {
      const prodActual = products.find(p => p.id === item.id);
      if (!prodActual || prodActual.cantidad < item.qty) {
        alert(`Stock insuficiente para el producto: ${item.nombre}`);
        return;
      }
    }

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
      alert("Error al registrar la venta en la base de datos: " + e.message);
    }
  };

  // --- LOGICA DE DEVOLUCIONES Y CAMBIOS ---
  const procesarDevolucionOCambio = async () => {
    if (!ventaSeleccionadaDev || !productoDevueltoItem) {
      alert("Selecciona la venta y el producto a devolver.");
      return;
    }

    try {
      // 1. Devolver stock al inventario del producto devuelto
      const prodInv = products.find(p => p.id === productoDevueltoItem.id);
      if (prodInv) {
        const nuevaCant = prodInv.cantidad + productoDevueltoItem.qty;
        await updateDoc(doc(db, COLLECTION_INVENTARIO, productoDevueltoItem.id), { cantidad: nuevaCant });
      }

      let detalleOperacion = "";

      if (tipoDevolucion === "devolucion") {
        if (ventaSeleccionadaDev.items.length === 1) {
          // Caso 2: Venta de un solo producto ➔ Se elimina la venta completa
          await deleteDoc(doc(db, COLLECTION_VENTAS, ventaSeleccionadaDev.id));
          detalleOperacion = "Devolución total (Venta eliminada)";
        } else {
          // Caso 1: Venta de varios productos ➔ Se remueve el item y se recalculan totales
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
        // Caso 3: Cambio por otro producto
        if (!productoCambioSeleccionado) {
          alert("Debes seleccionar el producto nuevo por el cual se hará el cambio.");
          return;
        }

        // Descontar stock del nuevo producto entregado
        const prodNuevoInv = products.find(p => p.id === productoCambioSeleccionado.id);
        if (!prodNuevoInv || prodNuevoInv.cantidad < 1) {
          alert("Stock insuficiente del producto de cambio.");
          return;
        }
        await updateDoc(doc(db, COLLECTION_INVENTARIO, productoCambioSeleccionado.id), { 
          cantidad: prodNuevoInv.cantidad - 1 
        });

        // Reemplazar item en la venta
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

      // Guardar registro de la devolución en su colección
      const registroDev = {
        fecha: new Date().toISOString(),
        ventaId: ventaSeleccionadaDev.id,
        tipo: tipoDevolucion,
        detalle: detalleOperacion,
        productoDevuelto: productoDevueltoItem.nombre,
        productoNuevo: productoCambioSeleccionado ? productoCambioSeleccionado.nombre : "N/A",
        montoDevuelto: parseFloat(montoReembolso) || 0,
        comision: comisionDevolucion || "Sin comisión"
      };

      await addDoc(collection(db, COLLECTION_DEVOLUCIONES), registroDev);

      // Limpiar y cerrar modal
      setModalDevolucionOpen(false);
      setVentaSeleccionadaDev(null);
      setProductoDevueltoItem(null);
      setProductoCambioSeleccionado(null);
      setMontoReembolso("");
      setComisionDevolucion("");
      alert("¡Devolución / Cambio registrado y stock actualizado con éxito!");
    } catch (e: any) {
      console.error("Error al procesar devolución:", e);
      alert("Error al procesar: " + e.message);
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
      return fechaVenta.getMonth() === ahora.getMonth() && fechaVenta.getFullYear() === ahora
