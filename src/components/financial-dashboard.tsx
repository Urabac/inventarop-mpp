import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  Package, 
  Boxes, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft,
  LayoutDashboard,
  Store,
  LogOut,
  Edit,
  Trash2,
  Plus,
  Save,
  X,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FinancialDashboard(props: any) {
  const {
    userEmail,
    logout,
    sales,
    openModal,
  } = props;

  // Estados locales para navegación y datos de inventario / Tasa BCV
  const [currentSection, setCurrentSection] = useState("inicio");
  
  // Tasa BCV y su estado de edición
  const [tasaBcv, setTasaBcv] = useState<number>(() => {
    const saved = localStorage.getItem("tasa_bcv");
    return saved ? parseFloat(saved) : 877.65; // Valor por defecto
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

  // Guardar inventario en localStorage para persistencia
  useEffect(() => {
    localStorage.setItem("inventario_pirueta", JSON.stringify(products));
  }, [products]);

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

  // Estados para el Modal de Agregar/Editar Producto
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
      // Editar existente
      setProducts(products.map(p => p.id === editandoId ? {
        ...p,
        codigo: formCodigo,
        nombre: formNombre,
        cantidad: cantidadNum,
        pCompra: pCompraNum
      } : p));
    } else {
      // Crear nuevo
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

  // Cálculo total de unidades en stock
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
        {/* ENCABEZADO SUPERIOR CON TASA BCV */}
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

            {/* Subtítulo y Tasa BCV Interactiva */}
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
                    <span className="text-lg font-bold text-white">{tasaBcv.toLocaleString("es-VE", { minimumFractionDigits: 2 })} BS</span>
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

        {/* CONTENEDOR CON MÁRGENES CÓMODOS */}
        <div className="max-w-7xl w-full mx-auto px-6 py-8">
          {currentSection === "inicio" && (
            <div className="space-y-8">
              {/* Acciones rápidas */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Acciones rápidas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={() => setCurrentSection("ventas")}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition text-left flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Ir a Ventas</p>
                        <p className="text-xs text-gray-500">Registrar transacciones</p>
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

              {/* Tarjetas de Resumen */}
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
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900">Historial de Ventas</h3>
                <Button onClick={() => alert("Módulo de ventas conectado.")} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  + Nueva Venta
                </Button>
              </div>
              {sales && sales.length > 0 ? (
                <div className="space-y-3">
                  {sales.map((sale: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl border border-gray-100 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <p className="font-bold text-gray-900">Venta #{sale.id || idx + 1}</p>
                        <p className="text-xs text-gray-500">{sale.date || "Transacción del día"}</p>
                      </div>
                      <span className="font-bold text-emerald-600">${sale.total || 0}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-12 text-center">No hay ventas registradas todavía.</p>
              )}
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

              {/* Tabla estilo Excel */}
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
                        <th className="
