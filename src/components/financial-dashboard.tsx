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
  Search
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

      {
