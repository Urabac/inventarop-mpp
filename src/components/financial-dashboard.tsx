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

export function FinancialDashboard(props: any) {
  const {
    userEmail,
    logout,
  } = props;

  // Estados locales para navegación y datos de inventario / Tasa BCV
  const [currentSection, setCurrentSection] = useState("inicio");
  
  // Tasa BCV y su estado de edición
  const [tasaBcv, setTasaBcv] = useState<number>(() => {
    const saved = localStorage.getItem("tasa_bcv");
    return saved ? parseFloat(saved) : 877.65;
  });
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [tempTasa, setTempTasa] = useState(tasaBcv.toString());

  // Estado de inventario local en formato tipo Excel
  const [products, setProducts] = useState<any[]>(() => {
    const saved = localStorage.getItem("inventario_pirueta");
    return saved ? JSON.parse(saved) : [
      { id: "1", codigo: "MP-001", nombre: "Bujía NGK Moto", cantidad: 12, pCompra: 0.80 },
      { id: "2", codigo: "MP-002", nombre: "Kit de arrastre GN125", cantidad: 4, pCompra: 18.00 }
    ];
  });

  // Estado de ventas con persistencia
  const [sales, setSales] = useState<any[]>(() => {
    const saved = localStorage.getItem("ventas_pirueta");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("inventario_pirueta", JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem("ventas_pirueta", JSON.stringify(sales));
  }, [sales]);

  // Guardar Tasa BCV
  const guardarTasa = () => {
    const val = parseFloat(tempTasa);
    if (!isNaN(val) && val > 0) {
      setTasaBcv(val);
      localStorage.setItem("tasa_bcv", val.toString());
      setEditandoTasa(false);
    }
  };

  // Función matemática de precios solicitada
  const calcularPrecios = (pCompra: number) => {
    let pVenta = 0;
    if (pCompra <= 1) {
      pVenta = 1.5;
    } else {
      pVenta = pCompra * 1.7; // +70%
    }
    const pFinalBs = pVenta * tasaBcv;
    return {
      pVenta: Number(pVenta.toFixed(2)),
      pFinalBs: Number(pFinalBs.toFixed(2))
    };
  };

  // Estados para Modal de Producto (Inventario)
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

  const guardarProducto = (e: React.FormEvent) => {
    e.preventDefault();
    const pCompraNum = parseFloat(formPCompra) || 0;
    const cantidadNum = parseInt(formCantidad) || 0;

    if (editandoId) {
      setProducts(products.map(p => p.id === editandoId ? {
        ...p,
        codigo: formCodigo,
        nombre: formNombre,
        cantidad: cantidadNum,
        pCompra: pCompraNum
      } : p));
    } else {
      const nuevoProd = {
        id: Date.now().toString(),
        codigo: formCodigo || `MP-${Math.floor(Math.random() * 900 + 100)}`,
        nombre: formNombre || "Sin nombre",
        cantidad: cantidadNum,
        pCompra: pCompraNum
      };
      setProducts([...products, nuevoProd]);
    }
    setModalProductoOpen(false);
  };

  const eliminarProducto = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  // --- ESTADOS PARA CREAR VENTA ---
  const [modalVentaOpen, setModalVentaOpen] = useState(false);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [filtroVentas, setFiltroVentas] = useState("dia"); // 'dia', 'semana', 'mes'

  const agregarAlCarrito = (prod: any) => {
    const calc = calcularPrecios(prod.pCompra);
    const itemExistente = carrito.find(item => item.id === prod.id);
    if (itemExistente) {
      setCarrito(carrito.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCarrito([...carrito, { ...prod, pVenta: calc.pVenta, pFinalBs: calc.pFinalBs, qty: 1 }]);
    }
  };

  const cambiarCantidadCarrito = (id: string, delta: number) => {
    setCarrito(carrito.map(item => {
      if (item.id === id) {
        const nuevaQty = item.qty + delta;
        return nuevaQty > 0 ? { ...item, qty: nuevaQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const totalVentaDolares = carrito.reduce((sum, item) => sum + (item.pVenta * item.qty), 0);
  const totalVentaBs = carrito.reduce((sum, item) => sum + (item.pFinalBs * item.qty), 0);

  const confirmarVenta = () => {
    if (carrito.length === 0) {
      alert("El carrito está vacío.");
      return;
    }
    if ((metodoPago === "Pago movil" || metodoPago === "Transferencia") && referenciaPago.length !== 4) {
      alert("Por favor ingresa un número de referencia válido de exactamente 4 dígitos.");
      return;
    }

    // Descontar inventario
    const nuevoInventario = products.map(prod => {
      const enCarrito = carrito.find(c => c.id === prod.id);
      if (enCarrito) {
        return { ...prod, cantidad: Math.max(0, prod.cantidad - enCarrito.qty) };
      }
      return prod;
    });
    setProducts(nuevoInventario);

    // Registrar venta
    const nuevaVenta = {
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      items: [...carrito],
      totalDolares: totalVentaDolares,
      totalBs: totalVentaBs,
      metodoPago,
      referencia: (metodoPago === "Pago movil" || metodoPago === "Transferencia") ? referenciaPago : ""
    };

    setSales([nuevaVenta, ...sales]);
    setCarrito([]);
    setMetodoPago("Efectivo");
    setReferenciaPago("");
    setModalVentaOpen(false);
  };

  // Filtrado de ventas
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

  // Función para generar reporte PDF imprimible estilo Excel
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
          <h2>MOTO PARTES PIRUETA - RÍO MARKET</h2>
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
      {/* SIDEBAR DE NAVEGACIÓN */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              Moto Partes Pirueta
            </span>
            <h1 className="text-xl font-bold text-gray-900 mt-2">Río Market</h1>
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

      {/* CONTENIDO PRINCIPAL */}
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
                Control rápido de inventario, tasas y transacciones del día.
              </p>
            </div>

            {/* Tasa BCV Interactiva */}
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

              {/* Lista de ventas filtradas */}
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
              <div className="flex justify-between items-center bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Inventario y Precios Automáticos</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Los precios de venta y bolívares se calculan con base en la Tasa BCV ({tasaBcv} BS).</p>
                </div>
                <Button onClick={abrirModalNuevo} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Agregar Producto
                </Button>
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
                      {products && products.length > 0 ? (
                        products.map((prod: any) => {
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
                            No hay productos registrados en el inventario. Haz clic en "Agregar Producto".
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

      {/* MODAL PARA CREAR VENTA */}
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
                            <p className="
