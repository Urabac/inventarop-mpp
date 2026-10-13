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
  Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- CONFIGURACIÓN DE FIREBASE ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot } from "firebase/firestore";

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

// --- COLECCIONES ESPECÍFICAS PARA EVITAR CRUCES CON OTROS PROYECTOS ---
const COLLECTION_INVENTARIO = "motopartes_pirueta_inventario";
const COLLECTION_VENTAS = "motopartes_pirueta_ventas";
const COLLECTION_CONFIG = "motopartes_pirueta_configuracion";

export function FinancialDashboard(props: any) {
  const {
    userEmail,
    logout,
  } = props;

  const [currentSection, setCurrentSection] = useState("inicio");
  
  const [tasaBcv, setTasaBcv] = useState<number>(877.65);
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [tempTasa, setTempTasa] = useState(tasaBcv.toString());

  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [busquedaInventario, setBusquedaInventario] = useState("");

  // SINCRONIZACIÓN EN TIEMPO REAL CON COLECCIONES AISLADAS
  useEffect(() => {
    // 1. Escuchar Inventario Exclusivo
    const unsubProducts = onSnapshot(collection(db, COLLECTION_INVENTARIO), (snapshot) => {
      const listaProd = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(listaProd);
    });

    // 2. Escuchar Ventas Exclusivas
    const unsubSales = onSnapshot(collection(db, COLLECTION_VENTAS), (snapshot) => {
      const listaVentas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      listaVentas.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setSales(listaVentas);
    });

    // 3. Escuchar Configuración Exclusiva (Tasa BCV)
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
      unsubTasa();
    };
  }, []);

  // Guardar Tasa BCV en la configuración aislada
  const guardarTasa = async () => {
    const val = parseFloat(tempTasa);
    if (!isNaN(val) && val > 0) {
      setTasaBcv(val);
      setEditandoTasa(false);
      await setDoc(doc(db, COLLECTION_CONFIG, "bcv"), { valor: val });
    }
  };

  const calcularPrecios = (pCompra: number) => {
    let pVenta = 0;
    if (pCompra <= 1) {
      pVenta = 1.5;
    } else {
      pVenta = pCompra * 1.7;
    }
    const pFinalBs = pVenta * tasaBcv;
    return {
      pVenta: Number(pVenta.toFixed(2)),
      pFinalBs: Number(pFinalBs.toFixed(2))
    };
  };

  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formCodigo, setFormCodigo] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formCantidad, setFormCantidad] = useState("");
  const [formPCompra, setFormPCompra] = useState("");

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

  // Guardar / Actualizar Producto en la colección exclusiva de Inventario
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

    if (editandoId) {
      await updateDoc(doc(db, COLLECTION_INVENTARIO, editandoId), datosProd);
    } else {
      await addDoc(collection(db, COLLECTION_INVENTARIO), datosProd);
    }
    setModalProductoOpen(false);
  };

  const eliminarProducto = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
      await deleteDoc(doc(db, COLLECTION_INVENTARIO, id));
    }
  };

  const [modalVentaOpen, setModalVentaOpen] = useState(false);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [filtroVentas, setFiltroVentas] = useState("dia");

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

  // Confirmar Venta y registrar en la colección exclusiva de Ventas
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

    // Descontar inventario en Firestore
    for (let enCarrito of carrito) {
      const prodActual = products.find(p => p.id === enCarrito.id);
      if (prodActual) {
        const nuevaCant = Math.max(0, prodActual.cantidad - enCarrito.qty);
        await updateDoc(doc(db, COLLECTION_INVENTARIO, enCarrito.id), { cantidad: nuevaCant });
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

  const productosFiltradosInventario = products.filter(p => 
    p.nombre.toLowerCase().includes(busquedaInventario.toLowerCase()) || 
    p.codigo.toLowerCase().includes(busquedaInventario.toLowerCase())
  );

  const generarReportePDF = () => {
    const ventasDelDia = sales.filter((sale: any) => {
      return new Date(sale.fecha).toDateString() === new Date().toDateString();
    });

    if (ventasDelDia.length === 0) {
      alert("No hay ventas registradas el día de hoy para generar el reporte.");
      return;
    }

    const totalDolarDia = ventasDelDia.reduce((acc, s) => acc + s.totalDolares, 0);
    const totalBsDia = ventasDelDia.reduce((acc, s) => acc + s.totalBs, 0);

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
            .totales { margin-top: 20px; text-align: right; font-size: 15px; font-weight: bold; }
            .print-btn { margin-top: 30px; text-align: center; }
            .print-btn button { background: #047857; color: white; border: none; padding: 10px 20px; font-size: 14px; border-radius: 6px; cursor: pointer; }
            @media print { .print-btn { display: none; } }
          </style>
        </head>
        <body>
          <h2>MOTO PARTES PIRUETA</h2>
          <p class="subtitle">Reporte Diario de Ventas</p>
          <div class="info">
            <strong>Fecha del reporte:</strong> ${new Date().toLocaleDateString()} <br>
            <strong>Tasa BCV aplicada:</strong> ${tasaBcv} BS
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
                  <td class="num">${s.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="totales">
            <p>Total del Día ($): $${totalDolarDia.toFixed(2)}</p>
            <p>Total del Día (BS): ${totalBsDia.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</p>
          </div>
          <div class="print-btn">
            <button onclick="window.print()">Imprimir / Guardar como PDF</button>
          </div>
        </body>
      </html>
    `);
    ventanaReporte.document.close();
  };

  const totalStock = products.reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);

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
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition",
                currentSection === "inicio" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <LayoutDashboard className="w-5 h-5" />
              Inicio
            </button>
            <button
              onClick={() => setCurrentSection("ventas")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition",
                currentSection === "ventas" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <CreditCard className="w-5 h-5" />
              Ventas
            </button>
            <button
              onClick={() => setCurrentSection("inventario")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition",
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
            {userEmail || "Administrador"}
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
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
                {currentSection === "inventario" && "Módulo de Inventario"}
              </h2>
              <p className="text-emerald-100 text-sm mt-1">
                Control exclusivo y seguro en la nube.
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
                    <button onClick={guardarTasa} className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded">
                      Confirmar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">
                      {tasaBcv.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS
                    </span>
                    <button 
                      onClick={() => { setTempTasa(tasaBcv.toString()); setEditandoTasa(true); }}
                      className="text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded font-medium transition"
                    >
                      Asignar / Editar
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={() => { setModalVentaOpen(true); }}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition text-left flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Nueva Venta</p>
                        <p className="text-xs text-gray-500">Registrar transacción rápida</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
                  </button>

                  <button 
                    onClick={() => setCurrentSection("inventario")}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition text-left flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Ver Inventario</p>
                        <p className="text-xs text-gray-500">Gestionar productos y precios</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Resumen general</h3>
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div 
                    onClick={() => setCurrentSection("inventario")}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:border-emerald-500 transition flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Unidades en stock</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">{totalStock}</p>
                    </div>
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                      <Package className="w-7 h-7" />
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
                      className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition", filtroVentas === "dia" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                    >
                      Día
                    </button>
                    <button 
                      onClick={() => setFiltroVentas("semana")}
                      className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition", filtroVentas === "semana" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                    >
                      Semana
                    </button>
                    <button 
                      onClick={() => setFiltroVentas("mes")}
                      className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition", filtroVentas === "mes" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                    >
                      Mes
                    </button>
                  </div>
                  <Button onClick={generarReportePDF} variant="outline" className="border-gray-300 text-gray-700 font-bold flex items-center gap-2">
                    <Printer className="w-4 h-4" /> Generar Reporte
                  </Button>
                  <Button onClick={() => setModalVentaOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2">
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
                          <p className="text-xs text-gray-400 mt-2">{new Date(sale.fecha).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-emerald-600">${sale.totalDolares.toFixed(2)}</p>
                          <p className="text-xs font-bold text-gray-500">{sale.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</p>
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

          {currentSection === "inventario" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white rounded-2xl border border-gray-200 p-6 shadow-sm gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Inventario y Precios Automáticos</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Los precios de venta y bolívares se calculan con base en la Tasa BCV ({tasaBcv} BS).</p>
                </div>
                <Button onClick={abrirModalNuevo} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2">
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
                              <td className="py-4 px-6 text-right font-black text-gray-900">{calc.pFinalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</td>
                              <td className="py-4 px-6 text-center flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => abrirModalEditar(prod)} 
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => eliminarProducto(prod.id)} 
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
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
                            No se encontraron productos con ese criterio de búsqueda.
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

      {modalVentaOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900">Registrar Nueva Venta</h3>
              <button 
                onClick={() => setModalVentaOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
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
                            <p className="text-xs text-gray-500">Stock: {prod.cantidad} | Venta: ${calc.pVenta} ({calc.pFinalBs} BS)</p>
                          </div>
                          <Button 
                            onClick={() => { agregarAlCarrito(prod); setBusquedaProducto(""); }}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
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
                          <p className="text-xs text-gray-500">${item.pVenta} c/u ({item.pFinalBs} BS)</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 bg-white border border-gray-200 px-2 py-1 rounded-lg">
                            <button onClick={() => cambiarCantidadCarrito(item.id, -1)} className="text-gray-500 font-bold px-1">-</button>
                            <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                            <button onClick={() => cambiarCantidadCarrito(item.id, 1)} className="text-gray-500 font-bold px-1">+</button>
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
                  <span className="text-xl font-black text-gray-900">{totalVentaBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</span>
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
                          "py-2 px-3 text-xs font-bold rounded-xl border transition text-center",
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
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
                <Button
                  onClick={confirmarVenta}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm"
                  disabled={carrito.length === 0}
                >
                  Confirmar y Guardar Venta
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalProductoOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900">
                {editandoId ? "Editar Producto" : "Nuevo Producto en Inventario"}
              </h3>
              <button 
                onClick={() => setModalProductoOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
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
                    <span className="font-black text-gray-900">{calcularPrecios(parseFloat(formPCompra)).pFinalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalProductoOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
                >
                  {editandoId ? "Actualizar Producto" : "Guardar Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
