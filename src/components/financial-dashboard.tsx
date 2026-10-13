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
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FinancialDashboard(props: any) {
  const {
    userEmail,
    logout,
    products,
    clients,
    sales,
    loans,
    purchases,
    loadingData,
    dataError,
    openModal,
    openSaleModal,
    openLoanModal,
    quickOpen,
    setQuickOpen,
    setSection,
    setPrintable,
  } = props;

  // Estado interno para controlar la sección activa si el componente lo maneja localmente
  const [currentSection, setCurrentSection] = useState("inicio");

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
            {userEmail}
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
        {/* ENCABEZADO SUPERIOR */}
        <header className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Sistema Express
            </span>
            <h2 className="text-3xl font-black mt-2">
              {currentSection === "inicio" && "Panel Principal"}
              {currentSection === "ventas" && "Módulo de Ventas"}
              {currentSection === "inventario" && "Módulo de Inventario"}
            </h2>
            <p className="text-emerald-100 text-sm mt-1">
              {currentSection === "inicio" && "Control rápido de inventario y registro de ventas del día."}
              {currentSection === "ventas" && "Historial y registro de transacciones comerciales."}
              {currentSection === "inventario" && "Gestión de stock, productos y existencias actuales."}
            </p>
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
                    onClick={() => openModal && openModal("venta")}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition text-left flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Registrar venta</p>
                        <p className="text-xs text-gray-500">Nueva transacción al cliente</p>
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
                        <p className="text-xs text-gray-500">Control de stock de productos</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                  </button>
                </div>
              </div>

              {/* Tarjetas de Resumen cómodas */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Resumen general</h3>
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div 
                    onClick={() => setCurrentSection("inventario")}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:border-emerald-500 transition flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Unidades en stock</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">
                        {products?.reduce((sum: number, item: any) => sum + (Number(item.stock) || 0), 0) || 0}
                      </p>
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
                <h3 className="text-lg font-bold text-gray-900">Listado de Ventas</h3>
                <Button onClick={() => openModal && openModal("venta")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  + Nueva Venta
                </Button>
              </div>
              {sales && sales.length > 0 ? (
                <div className="space-y-3">
                  {sales.map((sale: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl border border-gray-100 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <p className="font-bold text-gray-900">Venta #{sale.id || idx + 1}</p>
                        <p className="text-xs text-gray-500">{sale.date || "Fecha reciente"}</p>
                      </div>
                      <span className="font-bold text-emerald-600">${sale.total || 0}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-8 text-center">No hay ventas registradas todavía.</p>
              )}
            </div>
          )}

          {currentSection === "inventario" && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900">Inventario de Productos</h3>
                <Button onClick={() => openModal && openModal("producto")} className="bg-blue-600 hover:bg-blue-700 text-white">
                  + Agregar Producto
                </Button>
              </div>
              {products && products.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((prod: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900">{prod.name || prod.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">Precio: ${prod.price || 0}</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-600">Stock disponible:</span>
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                          {prod.stock || 0} un.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-8 text-center">No hay productos registrados en el inventario.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
