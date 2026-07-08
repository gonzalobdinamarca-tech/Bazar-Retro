import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import ProductCard from "./ProductCard";
import ProductEditor from "./ProductEditor";
import CatalogoCliente from "./CatalogoCliente";
import Login from "./Login";
import ConfigEditor from "./ConfigEditor";

export default function App() {
  const [viewMode, setViewMode] = useState("cliente");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [showQuickManage, setShowQuickManage] = useState(false);
  const [adminRefreshKey, setAdminRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    lowStock: 0,
    outOfStock: 0,
    totalValue: 0,
    topCategory: ""
  });
  const [categories, setCategories] = useState(["Adornos", "Jarros", "Relojes de arena"]); // Valores por defecto
  const [activeTab, setActiveTab] = useState("products"); // "products" o "config"
  const [siteConfig, setSiteConfig] = useState({ info_adicional: "" });
  const [editingConfig, setEditingConfig] = useState(false);
  const [configText, setConfigText] = useState("");

  useEffect(() => {
    // Verificar sesión al cargar
    checkUser();
    
    // Listener para cambios en autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
          setViewMode("cliente");
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadSiteConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("site_config")
        .select("*")
        .eq("key", "info_adicional")
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error("Error loading config:", error);
      } else if (data) {
        setSiteConfig({ info_adicional: data.value });
      }
    } catch (err) {
      console.error("Error loading site config:", err);
    }
  };

  useEffect(() => {
    loadProducts();
    loadSiteConfig();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading products:", error);
    } else {
      setProducts(data || []);
      calculateStats(data || []);
      
      // Extraer categorías únicas dinámicamente
      if (data && data.length > 0) {
        const uniqueCategories = [...new Set(data.map(p => p.category).filter(Boolean))];
        const sortedCategories = uniqueCategories.sort((a, b) => 
          a.localeCompare(b, 'es', { sensitivity: 'base' })
        );
        
        // Combinar con categorías actuales sin duplicar
        setCategories(prev => {
          const combined = [...new Set([...prev, ...sortedCategories])];
          return combined.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        });
      }
    }
    setLoading(false);
  };

  const checkUser = async () => {
    setCheckingAuth(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
    }
    setCheckingAuth(false);
  };

  const calculateStats = (productList) => {
    const total = productList.length;
    const available = productList.filter(p => p.quantity > 3).length;
    const lowStock = productList.filter(p => p.quantity > 0 && p.quantity <= 3).length;
    const outOfStock = productList.filter(p => p.quantity === 0).length;
    const totalValue = productList.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    
    // Categoría más popular
    const categoryCounts = {};
    productList.forEach(p => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });
    const topCategory = Object.keys(categoryCounts).reduce((a, b) => 
      categoryCounts[a] > categoryCounts[b] ? a : b, ""
    );

    setStats({
      total,
      available,
      lowStock,
      outOfStock,
      totalValue,
      topCategory
    });
  };

  const updateProduct = async (id, updates) => {
    const { error } = await supabase
      .from("products")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Error updating product:", error);
      alert("Error al actualizar el producto");
    } else {
      loadProducts();
      setEditingProduct(null);
      setAdminRefreshKey((k) => k + 1);
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("Error deleting product:", error);
      alert("Error al eliminar el producto");
    } else {
      loadProducts();
      setAdminRefreshKey((k) => k + 1);
    }
  };

  const createProduct = async (newProduct) => {
    const { error } = await supabase.from("products").insert([newProduct]);

    if (error) {
      console.error("Error creating product:", error);
      alert("Error al crear el producto");
    } else {
      loadProducts();
      setShowNewProductForm(false);
      setAdminRefreshKey((k) => k + 1);
    }
  };

  const handleLoginSuccess = (loggedUser) => {
    setUser(loggedUser);
    setViewMode("admin");
  };

  const handleLogout = async () => {
    if (confirm("¿Cerrar sesión?")) {
      await supabase.auth.signOut();
      setUser(null);
      setViewMode("cliente");
    }
  };

  const switchToAdmin = () => {
    setViewMode("admin"); // Esto mostrará el Login si no hay user
  };

  const startEditingConfig = () => {
    setConfigText(siteConfig.info_adicional || "");
    setEditingConfig(true);
  };

  const saveConfig = async () => {
    try {
      const { error } = await supabase
        .from("site_config")
        .upsert({
          key: "info_adicional",
          value: configText,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "key"
        });

      if (error) throw error;

      setSiteConfig({ info_adicional: configText });
      setEditingConfig(false);
      alert("✅ Información actualizada correctamente");
      loadSiteConfig(); // Recargar
    } catch (err) {
      console.error("Error saving config:", err);
      alert("❌ Error al guardar la información");
    }
  };

  // Mostrar login si intentan acceder a admin sin estar autenticados
  if (viewMode === "admin" && !user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Pantalla de carga inicial
  if (checkingAuth) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 50%, #c5d3d1 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            border: '4px solid #5b7a7a',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ fontSize: '18px', color: '#2c4a4a', fontWeight: '600' }}>
            Verificando sesión...
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === "cliente") {
    return <CatalogoCliente onSwitchToAdmin={switchToAdmin} siteConfig={siteConfig} />;
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 50%, #c5d3d1 100%)',
        minWidth: '100vw'
      }}>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            border: '4px solid #5b7a7a',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ fontSize: '20px', color: '#1e3a3a', fontWeight: '500' }}>Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 50%, #c5d3d1 100%)',
      minWidth: '100vw'
    }}>
      <style>{`
        /* RESPONSIVE MEDIA QUERIES */
        .admin-product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 32px;
        }

        .admin-header-padding {
          padding: 32px 24px;
        }

        .admin-logo {
          height: 96px;
        }

        .admin-title {
          font-size: 48px;
        }

        .admin-subtitle {
          font-size: 18px;
        }

        .admin-add-button {
          padding: 16px 32px;
          font-size: 18px;
        }

        .admin-action-buttons {
          display: flex;
          gap: 8px;
          padding: 16px;
        }

        /* TABLET - 768px and down */
        @media (max-width: 768px) {
          .admin-product-grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 24px;
          }

          .admin-header-padding {
            padding: 24px 16px;
          }

          .admin-logo {
            height: 80px;
          }

          .admin-title {
            font-size: 36px;
          }

          .admin-subtitle {
            font-size: 16px;
          }

          .admin-add-button {
            padding: 14px 24px;
            font-size: 16px;
          }
        }

        /* MOBILE - 480px and down */
        @media (max-width: 480px) {
          .admin-product-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .admin-header-padding {
            padding: 20px 12px;
          }

          .admin-logo {
            height: 70px;
          }

          .admin-title {
            font-size: 28px;
          }

          .admin-subtitle {
            font-size: 15px;
          }

          .admin-add-button {
            padding: 14px 20px;
            font-size: 16px;
            width: 100%;
          }

          .admin-action-buttons {
            gap: 8px;
            padding: 12px;
          }

          /* Modales fullscreen en móvil */
          .admin-modal {
            padding: 0;
            align-items: stretch;
          }

          .admin-modal-content {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
            height: 100vh;
          }
        }
      `}</style>

      {/* Textura vintage */}
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: 0.1,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.3'/%3E%3C/svg%3E")`
      }}></div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* Header */}
        <header style={{
          background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 100%)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          borderBottom: '3px solid #a8b8b5'
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
            <div className="admin-header-padding">
              {/* Botón cambiar vista */}
              <div style={{ textAlign: 'right', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Info usuario */}
                  <div style={{
                    background: 'rgba(122,153,153,0.1)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#2c4a4a',
                    fontWeight: '600'
                  }}>
                    👤 {user?.email}
                  </div>

                  <button
                    onClick={() => setViewMode("cliente")}
                    style={{
                      background: 'linear-gradient(135deg, #7a9999, #5b7a7a)',
                      color: 'white',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      fontWeight: '600',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      fontSize: '14px',
                      minHeight: '44px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    👁️ Ver Catálogo
                  </button>

                  <button
                    onClick={handleLogout}
                    style={{
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: 'white',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      fontWeight: '600',
                      boxShadow: '0 4px 6px rgba(220,38,38,0.2)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      fontSize: '14px',
                      minHeight: '44px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 6px 8px rgba(220,38,38,0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(220,38,38,0.2)';
                    }}
                  >
                    🚪 Cerrar Sesión
                  </button>
                </div>
              </div>

              {/* Logo */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="https://cienciaterapia.org/wp-content/uploads/reloj-arena.png"
                    alt="Bazar Retro"
                    className="admin-logo"
                    style={{ margin: '0 auto', display: 'block', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))' }}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: '-8px',
                    background: '#7a9999',
                    borderRadius: '50%',
                    filter: 'blur(40px)',
                    opacity: 0.2,
                    zIndex: -1
                  }}></div>
                </div>
              </div>

              {/* Título */}
              <h1 className="admin-title" style={{
                fontWeight: 'bold',
                textAlign: 'center',
                color: '#1e3a3a',
                marginBottom: '8px',
                textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                fontFamily: 'Georgia, serif'
              }}>
                Bazar Retro - Panel Admin
              </h1>
              <p className="admin-subtitle" style={{
                textAlign: 'center',
                color: '#4a6565',
                fontStyle: 'italic',
                fontFamily: 'Georgia, serif',
                padding: '0 12px'
              }}>
                Gestiona tu catálogo de productos
              </p>
            </div>

            <div style={{
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #7a9999, transparent)'
            }}></div>
          </div>
        </header>

        {/* Contenido */}
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
          <div style={{ padding: '32px 0' }}>
            
            {/* Tabs de navegación */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '32px',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '0'
            }}>
              <button
                onClick={() => setActiveTab("products")}
                style={{
                  padding: '14px 28px',
                  background: activeTab === "products" ? 'linear-gradient(135deg, #7a9999, #5b7a7a)' : 'transparent',
                  color: activeTab === "products" ? 'white' : '#4a6565',
                  border: 'none',
                  borderBottom: activeTab === "products" ? '3px solid #5b7a7a' : '3px solid transparent',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '700',
                  transition: 'all 0.3s',
                  borderRadius: '8px 8px 0 0',
                  fontFamily: 'Georgia, serif',
                  minHeight: '50px'
                }}
                onMouseOver={(e) => {
                  if (activeTab !== "products") {
                    e.currentTarget.style.background = 'rgba(122,153,153,0.1)';
                  }
                }}
                onMouseOut={(e) => {
                  if (activeTab !== "products") {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                📦 Productos
              </button>

              <button
                onClick={() => setActiveTab("config")}
                style={{
                  padding: '14px 28px',
                  background: activeTab === "config" ? 'linear-gradient(135deg, #7a9999, #5b7a7a)' : 'transparent',
                  color: activeTab === "config" ? 'white' : '#4a6565',
                  border: 'none',
                  borderBottom: activeTab === "config" ? '3px solid #5b7a7a' : '3px solid transparent',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '700',
                  transition: 'all 0.3s',
                  borderRadius: '8px 8px 0 0',
                  fontFamily: 'Georgia, serif',
                  minHeight: '50px'
                }}
                onMouseOver={(e) => {
                  if (activeTab !== "config") {
                    e.currentTarget.style.background = 'rgba(122,153,153,0.1)';
                  }
                }}
                onMouseOut={(e) => {
                  if (activeTab !== "config") {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                ⚙️ Configuración
              </button>
            </div>

            {/* Contenido según tab activo */}
            {activeTab === "products" ? (
              <>
            {/* Dashboard de Estadísticas */}
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '32px',
              marginBottom: '32px',
              border: '3px solid #a8b8b5',
              boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#1e3a3a',
                marginBottom: '24px',
                fontFamily: 'Georgia, serif',
                textAlign: 'center'
              }}>
                📊 Resumen del Catálogo
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}>
                {/* Total productos */}
                <div style={{
                  background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #93c5fd',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>📦</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e40af', marginBottom: '4px' }}>
                    {stats.total}
                  </div>
                  <div style={{ fontSize: '14px', color: '#1e40af', fontWeight: '600' }}>
                    Total Productos
                  </div>
                </div>

                {/* Disponibles */}
                <div style={{
                  background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #6ee7b7',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#065f46', marginBottom: '4px' }}>
                    {stats.available}
                  </div>
                  <div style={{ fontSize: '14px', color: '#065f46', fontWeight: '600' }}>
                    Disponibles ({stats.total > 0 ? Math.round((stats.available / stats.total) * 100) : 0}%)
                  </div>
                </div>

                {/* Poco stock */}
                <div style={{
                  background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #fcd34d',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>⚠️</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#92400e', marginBottom: '4px' }}>
                    {stats.lowStock}
                  </div>
                  <div style={{ fontSize: '14px', color: '#92400e', fontWeight: '600' }}>
                    Poco Stock ({stats.total > 0 ? Math.round((stats.lowStock / stats.total) * 100) : 0}%)
                  </div>
                </div>

                {/* Agotados */}
                <div style={{
                  background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px solid #fca5a5',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔴</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>
                    {stats.outOfStock}
                  </div>
                  <div style={{ fontSize: '14px', color: '#991b1b', fontWeight: '600' }}>
                    Agotados ({stats.total > 0 ? Math.round((stats.outOfStock / stats.total) * 100) : 0}%)
                  </div>
                </div>
              </div>

              {/* Info adicional */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
                paddingTop: '20px',
                borderTop: '2px solid #e5e7eb'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #f0f0e8, #dce3e0)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '2px solid #a8b8b5'
                }}>
                  <div style={{ fontSize: '14px', color: '#4a6565', marginBottom: '4px', fontWeight: '600' }}>
                    💰 Valor Total Inventario
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c4a4a' }}>
                    ${stats.totalValue.toLocaleString('es-CL')}
                  </div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #f0f0e8, #dce3e0)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '2px solid #a8b8b5'
                }}>
                  <div style={{ fontSize: '14px', color: '#4a6565', marginBottom: '4px', fontWeight: '600' }}>
                    🏆 Categoría Popular
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2c4a4a' }}>
                    {stats.topCategory || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Configuración de Información Adicional */}
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '32px',
              marginBottom: '32px',
              border: '3px solid #a8b8b5',
              boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{
                  fontSize: '22px',
                  fontWeight: 'bold',
                  color: '#1e3a3a',
                  fontFamily: 'Georgia, serif',
                  margin: 0
                }}>
                  📝 Información Adicional del Catálogo
                </h2>
                {!editingConfig && (
                  <button
                    onClick={startEditingConfig}
                    style={{
                      background: 'linear-gradient(135deg, #7a9999, #5b7a7a)',
                      color: 'white',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      boxShadow: '0 4px 8px rgba(91,122,122,0.2)',
                      transition: 'all 0.3s',
                      minHeight: '44px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 6px 12px rgba(91,122,122,0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(91,122,122,0.2)';
                    }}
                  >
                    ✏️ Editar
                  </button>
                )}
              </div>

              {editingConfig ? (
                <div>
                  <p style={{ fontSize: '14px', color: '#6b7a7a', marginBottom: '12px' }}>
                    Este texto aparecerá debajo de "Cómo funciona el carrito" en el catálogo público:
                  </p>
                  <textarea
                    value={configText}
                    onChange={(e) => setConfigText(e.target.value)}
                    rows="10"
                    placeholder="💳 MEDIOS DE PAGO&#10;• Transferencia bancaria&#10;• Efectivo al retirar&#10;&#10;🚚 ENVÍO Y RETIRO&#10;..."
                    style={{
                      width: '100%',
                      padding: '16px',
                      border: '2px solid #d1d5db',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                      minHeight: '200px',
                      boxSizing: 'border-box',
                      color: '#1f2937',
                      background: 'white'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button
                      onClick={saveConfig}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        padding: '14px',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '16px',
                        boxShadow: '0 4px 8px rgba(16,185,129,0.3)',
                        transition: 'all 0.3s',
                        minHeight: '48px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 12px rgba(16,185,129,0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(16,185,129,0.3)';
                      }}
                    >
                      ✓ Guardar Cambios
                    </button>
                    <button
                      onClick={() => setEditingConfig(false)}
                      style={{
                        flex: 1,
                        background: '#6b7280',
                        color: 'white',
                        padding: '14px',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '16px',
                        boxShadow: '0 4px 8px rgba(107,114,128,0.3)',
                        transition: 'all 0.3s',
                        minHeight: '48px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#4b5563';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = '#6b7280';
                      }}
                    >
                      ✕ Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: '#f9fafb',
                  padding: '20px',
                  borderRadius: '10px',
                  border: '2px solid #e5e7eb'
                }}>
                  {siteConfig.info_adicional ? (
                    <pre style={{
                      margin: 0,
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      color: '#374151',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word'
                    }}>
                      {siteConfig.info_adicional}
                    </pre>
                  ) : (
                    <p style={{ margin: 0, color: '#9ca3af', fontStyle: 'italic' }}>
                      No hay información adicional configurada. Click en "Editar" para agregar.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Botón agregar */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <button
                onClick={() => setShowNewProductForm(true)}
                className="admin-add-button"
                style={{
                  background: 'linear-gradient(135deg, #7a9999, #5b7a7a)',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: '600',
                  boxShadow: '0 8px 16px rgba(91,122,122,0.3)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Georgia, serif',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
                  transition: 'all 0.3s',
                  minHeight: '48px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(91,122,122,0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(91,122,122,0.3)';
                }}
              >
                ✨ Agregar Nuevo Producto
              </button>
            </div>

            {/* Modal nuevo */}
            {showNewProductForm && (
              <div className="admin-modal" style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                zIndex: 1000,
                backdropFilter: 'blur(4px)'
              }}>
                <div className="admin-modal-content" style={{
                  background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 100%)',
                  borderRadius: '16px',
                  padding: '32px',
                  maxWidth: '672px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                  border: '4px solid #a8b8b5'
                }}>
                  <h2 style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    marginBottom: '24px',
                    color: '#1e3a3a',
                    fontFamily: 'Georgia, serif'
                  }}>
                    ✨ Nuevo Producto
                  </h2>
                  <ProductEditor
                    product={{
                      name: "",
                      description: "",
                      quantity: 0,
                      price: 0,
                      category: categories[0] || "",
                      images: [],
                      videos: [],
                    }}
                    existingCategories={categories}
                    onSave={createProduct}
                    onCancel={() => setShowNewProductForm(false)}
                  />
                </div>
              </div>
            )}

            {/* Modal editar */}
            {editingProduct && (
              <div className="admin-modal" style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                zIndex: 1000,
                backdropFilter: 'blur(4px)'
              }}>
                <div className="admin-modal-content" style={{
                  background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 100%)',
                  borderRadius: '16px',
                  padding: '32px',
                  maxWidth: '672px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                  border: '4px solid #a8b8b5'
                }}>
                  <h2 style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    marginBottom: '24px',
                    color: '#1e3a3a',
                    fontFamily: 'Georgia, serif'
                  }}>
                    ✏️ Editar Producto
                  </h2>
                  <ProductEditor
                    product={editingProduct}
                    existingCategories={categories}
                    onSave={(updates) => updateProduct(editingProduct.id, updates)}
                    onCancel={() => setEditingProduct(null)}
                  />
                </div>
              </div>
            )}

            {/* Catálogo real en modo admin - muestra exactamente lo que ve el público */}
            <CatalogoCliente
              key={adminRefreshKey}
              adminMode={true}
              onEditProduct={(product) => setEditingProduct(product)}
              onDeleteProduct={(id) => deleteProduct(id)}
            />

            {/* Sin productos */}
            {products.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: '48px 24px',
                  maxWidth: '448px',
                  margin: '0 auto',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                  border: '4px solid #c5d3d1'
                }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏺</div>
                  <p style={{
                    fontSize: '24px',
                    color: '#1e3a3a',
                    fontWeight: '600',
                    marginBottom: '8px',
                    fontFamily: 'Georgia, serif'
                  }}>
                    Catálogo vacío
                  </p>
                  <p style={{ color: '#4a6565' }}>¡Agrega tu primer producto!</p>
                </div>
              </div>
            )}
          </>
            ) : (
              /* Tab de Configuración */
              <ConfigEditor />
            )}
          </div>
        </div>

        {/* Footer */}
        <footer style={{
          marginTop: '64px',
          background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 100%)',
          padding: '24px 16px',
          borderTop: '4px solid #a8b8b5'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #7a9999, transparent)',
              marginBottom: '16px',
              maxWidth: '200px',
              margin: '0 auto 16px'
            }}></div>
            <p style={{ color: '#4a6565', fontStyle: 'italic', fontSize: '14px' }}>
              Panel de Administración - Bazar Retro ✨
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}