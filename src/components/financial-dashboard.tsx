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
