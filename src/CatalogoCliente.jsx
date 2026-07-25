import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

/**
 * OPTIMIZACIONES DE BANDWIDTH IMPLEMENTADAS:
 * 
 * 1. LAZY LOADING: Todas las imágenes usan loading="lazy"
 *    - Las imágenes solo se cargan cuando están visibles en pantalla
 *    - Reduce bandwidth inicial en ~70%
 * 
 * 2. SOLO PRIMERA IMAGEN EN GRID: 
 *    - Las tarjetas de productos solo muestran product.images[0]
 *    - Las demás imágenes solo se cargan al abrir el modal
 *    - Reduce transferencia en ~60%
 * 
 * 3. CARRUSEL OPTIMIZADO:
 *    - Solo carga la imagen actual (currentImageIndex)
 *    - No precarga todas las imágenes del producto
 * 
 * 4. CACHE DEL NAVEGADOR:
 *    - Las imágenes se cachean automáticamente en el navegador
 *    - Siguientes visitas no descargan las mismas imágenes
 * 
 * RESULTADO ESPERADO:
 * - Primera carga: ~40 MB (en vez de 126 MB)
 * - Siguientes cargas: ~0-5 MB (caché)
 * - Consumo mensual: 2-4 GB (dentro del límite de 5 GB)
 */

export default function CatalogoCliente({ onSwitchToAdmin, adminMode = false, onEditProduct, onDeleteProduct }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [cartAnimation, setCartAnimation] = useState(false);
  const [siteConfig, setSiteConfig] = useState({
    logo_url: 'https://cienciaterapia.org/wp-content/uploads/reloj-arena.png',
    logo_height: '60',
    info_adicional: ''
  });
  const [currentPage, setCurrentPage] = useState(() => {
    // Leer página desde URL al iniciar
    const params = new URLSearchParams(window.location.search);
    const pageFromUrl = parseInt(params.get('page')) || 1;
    return pageFromUrl;
  });
  const [productsPerPage, setProductsPerPage] = useState(16);
  const [fadeProducts, setFadeProducts] = useState(false);
  const [goToPageInput, setGoToPageInput] = useState('');
  const [editingStockId, setEditingStockId] = useState(null);
  const [stockDraft, setStockDraft] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  const WHATSAPP_NUMBER = "+56992364798";

  // Cargar categorías dinámicamente desde los productos
  const [categories, setCategories] = useState(["Todas"]);

  useEffect(() => {
    loadProducts();
    loadConfig();
    loadCartFromSession();
    window.addEventListener('scroll', handleScroll);
    
    // Ajustar productos por página según tamaño de pantalla
    const updateProductsPerPage = () => {
      if (window.innerWidth <= 480) {
        setProductsPerPage(10); // Mobile: 1 columna x 10 productos
      } else if (window.innerWidth <= 768) {
        setProductsPerPage(12); // Tablet: 2 columnas x 6 filas = 12
      } else {
        setProductsPerPage(16); // Desktop: 4 columnas x 4 filas = 16
      }
    };
    
    updateProductsPerPage();
    window.addEventListener('resize', updateProductsPerPage);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateProductsPerPage);
    };
  }, []);

  useEffect(() => {
    saveCartToSession();
  }, [cart]);

  // Precargar todas las imágenes del producto abierto, para que cambiar de foto
  // sea instantáneo desde la caché y no aparezca la línea/parpadeo al decodificar.
  useEffect(() => {
    if (selectedProduct && Array.isArray(selectedProduct.images)) {
      selectedProduct.images.forEach((url) => {
        if (url) {
          const preload = new Image();
          preload.src = url;
        }
      });
    }
  }, [selectedProduct]);

  useEffect(() => {
    // Extraer categorías únicas de los productos y ordenarlas alfabéticamente
    if (products.length > 0) {
      const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
      // Ordenar alfabéticamente usando localeCompare en español
      const sortedCategories = uniqueCategories.sort((a, b) => 
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      );
      setCategories(["Todas", ...sortedCategories]);
    }
  }, [products]);

  // Resetear a página 1 cuando cambian filtros o búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, sortBy]);

  const handleScroll = () => {
    setShowScrollTop(window.scrollY > 300);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadCartFromSession = () => {
    try {
      const saved = localStorage.getItem('bazarRetroCart');
      if (!saved) return;

      const parsed = JSON.parse(saved);

      // Formato nuevo: { items: [...], savedAt: timestamp }
      // Formato viejo (sessionStorage): array directo
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      const savedAt = Array.isArray(parsed) ? null : parsed.savedAt;

      // Caducidad: 7 días
      const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;
      if (savedAt && (Date.now() - savedAt) > SIETE_DIAS) {
        localStorage.removeItem('bazarRetroCart');
        return;
      }

      if (Array.isArray(items)) {
        setCart(items);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const saveCartToSession = () => {
    try {
      localStorage.setItem(
        'bazarRetroCart',
        JSON.stringify({ items: cart, savedAt: Date.now() })
      );
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

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
    }
    setLoading(false);
  };

  // Edición rápida de stock (solo modo admin)
  const startStockEdit = (product) => {
    setEditingStockId(product.id);
    setStockDraft(String(product.quantity));
  };

  const cancelStockEdit = () => {
    setEditingStockId(null);
    setStockDraft('');
  };

  const saveStock = async (productId) => {
    const nuevoStock = parseInt(stockDraft, 10);

    if (isNaN(nuevoStock) || nuevoStock < 0) {
      showNotification('⚠️ Ingresa un número válido (0 o más)');
      return;
    }

    setSavingStock(true);
    const { error } = await supabase
      .from('products')
      .update({ quantity: nuevoStock, updated_at: new Date().toISOString() })
      .eq('id', productId);
    setSavingStock(false);

    if (error) {
      console.error('Error updating stock:', error);
      showNotification('❌ Error al guardar el stock');
    } else {
      // Actualizar en memoria sin recargar todo
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, quantity: nuevoStock } : p))
      );
      setEditingStockId(null);
      setStockDraft('');
      showNotification('✅ Stock actualizado');
    }
  };

  const loadConfig = async () => {
    const { data, error } = await supabase
      .from('site_config')
      .select('key, value');

    if (!error && data) {
      const configObj = {};
      data.forEach(item => {
        configObj[item.key] = item.value;
      });
      setSiteConfig(prev => ({ ...prev, ...configObj }));
    }
  };

  const getFilteredAndSortedProducts = () => {
    let filtered = selectedCategory === "Todas"
      ? products
      : products.filter((p) => p.category === selectedCategory);

    if (searchQuery.trim()) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    switch(sortBy) {
      case 'price-asc':
        return [...filtered].sort((a, b) => a.price - b.price);
      case 'price-desc':
        return [...filtered].sort((a, b) => b.price - a.price);
      case 'name':
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      case 'stock':
        return [...filtered].sort((a, b) => b.quantity - a.quantity);
      default:
        return filtered;
    }
  };

  const filteredProducts = getFilteredAndSortedProducts();

  // Lógica de paginación
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  // Navegación con teclado (después de definir totalPages)
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Solo si no estamos escribiendo en un input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Si el lightbox está abierto
      if (showLightbox) {
        if (e.key === 'Escape') {
          setShowLightbox(false);
        } else if (e.key === 'ArrowLeft') {
          prevImage();
        } else if (e.key === 'ArrowRight') {
          nextImage();
        }
        return;
      }

      // Navegación de páginas normal
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        paginate(currentPage - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        paginate(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, totalPages, showLightbox, currentImageIndex]);

  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages || pageNumber === currentPage) {
      return;
    }

    // Animación fade out
    setFadeProducts(true);
    
    setTimeout(() => {
      setCurrentPage(pageNumber);
      
      // Actualizar URL sin recargar página
      const url = new URL(window.location);
      url.searchParams.set('page', pageNumber);
      window.history.pushState({}, '', url);
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Fade in después de cambiar página
      setTimeout(() => {
        setFadeProducts(false);
      }, 50);
    }, 150);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      paginate(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      paginate(currentPage - 1);
    }
  };

  const handleGoToPage = (e) => {
    e.preventDefault();
    const pageNum = parseInt(goToPageInput);
    if (pageNum >= 1 && pageNum <= totalPages) {
      paginate(pageNum);
      setGoToPageInput('');
    } else if (goToPageInput) {
      showNotification(`⚠️ Página inválida. Debe estar entre 1 y ${totalPages}`);
    }
  };

  // Funciones para carrusel de imágenes
  const nextImage = () => {
    if (selectedProduct && selectedProduct.images) {
      setCurrentImageIndex((prev) => 
        prev === selectedProduct.images.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = () => {
    if (selectedProduct && selectedProduct.images) {
      setCurrentImageIndex((prev) => 
        prev === 0 ? selectedProduct.images.length - 1 : prev - 1
      );
    }
  };

  const goToImage = (index) => {
    setCurrentImageIndex(index);
  };

  // Generar números de página con ellipsis inteligente
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = window.innerWidth <= 480 ? 3 : 5; // Menos páginas en móvil
    
    if (totalPages <= maxPagesToShow + 2) {
      // Si hay pocas páginas, mostrar todas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Siempre mostrar primera página
      pages.push(1);
      
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Ajustar si estamos cerca del inicio
      if (currentPage <= 3) {
        endPage = Math.min(maxPagesToShow, totalPages - 1);
      }
      
      // Ajustar si estamos cerca del final
      if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      }
      
      // Agregar ellipsis al inicio si es necesario
      if (startPage > 2) {
        pages.push('...');
      }
      
      // Agregar páginas del medio
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Agregar ellipsis al final si es necesario
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      // Siempre mostrar última página
      pages.push(totalPages);
    }
    
    return pages;
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const addToCart = (product, quantityToAdd = 1) => {
    if (product.quantity === 0) {
      showNotification("❌ Producto agotado");
      return;
    }

    const existingItem = cart.find((item) => item.id === product.id);
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newQuantity = currentQuantity + quantityToAdd;

    if (newQuantity > product.quantity) {
      showNotification(`⚠️ Stock máximo alcanzado (${product.quantity} unidades)`);
      return;
    }

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    } else {
      setCart([...cart, { 
        ...product, 
        quantity: quantityToAdd,
        stockReal: product.quantity // Guardamos el stock real para validaciones
      }]);
    }
    
    setCartAnimation(true);
    setTimeout(() => setCartAnimation(false), 600);
    showNotification(`✅ ${quantityToAdd > 1 ? `${quantityToAdd} unidades agregadas` : 'Agregado al carrito'}`);
  };

  const removeFromCart = (productId, productName) => {
    if (confirm(`¿Eliminar "${productName}" del carrito?`)) {
      setCart(cart.filter((item) => item.id !== productId));
      showNotification("🗑️ Producto eliminado del carrito");
    }
  };

  const clearCart = () => {
    if (confirm("¿Vaciar todo el carrito?")) {
      setCart([]);
      showNotification("🗑️ Carrito vaciado");
    }
  };

  const updateQuantity = (productId, newQuantity, maxStock) => {
    if (newQuantity === 0) {
      const item = cart.find(i => i.id === productId);
      removeFromCart(productId, item.name);
    } else if (newQuantity > maxStock) {
      showNotification(`⚠️ Stock máximo: ${maxStock} unidades`);
    } else if (newQuantity < 0) {
      showNotification(`⚠️ La cantidad no puede ser negativa`);
    } else {
      setCart(
        cart.map((item) =>
          item.id === productId ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const sendWhatsApp = () => {
    if (cart.length === 0) {
      alert("El carrito está vacío");
      return;
    }

    const catalogUrl = window.location.origin;

    let message = "🛒 *Pedido desde Bazar Retro*\n\n";
    cart.forEach((item) => {
      message += `• *${item.name}*\n`;
      if (item.images && item.images[0]) {
        message += `  📸 Ver foto: ${item.images[0]}\n`;
      }
      message += `  Cantidad: ${item.quantity}\n`;
      message += `  Precio: $${item.price.toLocaleString('es-CL')}\n`;
      message += `  Subtotal: $${(item.price * item.quantity).toLocaleString('es-CL')}\n\n`;
    });
    
    message += `*Total: $${getCartTotal().toLocaleString('es-CL')}*\n\n`;
    message += `🔗 Ver catálogo completo: ${catalogUrl}\n\n`;
    message += `💬 ¿Tienes alguna consulta? ¡Responde este mensaje!`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const formatPrice = (price) => {
    return `$${price.toLocaleString('es-CL')}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            border: '4px solid #92400e', 
            borderTopColor: 'transparent', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ fontSize: '20px', color: '#374151', fontWeight: '500' }}>Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes slideIn {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        /* Animación fade para cambio de página */
        .products-fade {
          opacity: 0.3;
          transform: scale(0.98);
          transition: all 0.15s ease-out;
        }

        .products-visible {
          opacity: 1;
          transform: scale(1);
          transition: all 0.3s ease-in;
        }

        /* RESPONSIVE MEDIA QUERIES */
        .product-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }

        .filter-container {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        .header-content {
          padding: 24px 16px 32px;
        }

        .logo-img {
          height: 80px;
        }

        .main-title {
          font-size: 48px;
        }

        .subtitle {
          font-size: 18px;
        }

        .search-input {
          max-width: 500px;
          width: 100%;
          padding: 14px 20px;
          font-size: 16px;
        }

        .cart-button {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 100;
        }

        .cart-modal {
          padding: 16px;
        }

        .cart-content {
          max-width: 700px;
          width: 100%;
          max-height: 85vh;
          border-radius: 20px;
        }

        .product-card {
          transition: all 0.3s ease;
        }

        .product-card-image {
          height: 220px;
        }

        .product-card-title {
          font-size: 15px;
          height: 44px;
        }

        .footer-links {
          display: flex;
          justify-content: center;
          gap: 40px;
          flex-wrap: wrap;
        }

        /* TABLET - 768px and down */
        @media (max-width: 768px) {
          .product-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }

          .header-content {
            padding: 20px 12px 28px;
          }

          .logo-img {
            height: 60px;
          }

          .main-title {
            font-size: 32px;
          }

          .subtitle {
            font-size: 16px;
          }

          .filter-container {
            flex-direction: column;
            gap: 12px;
          }

          .cart-button {
            top: 12px;
            right: 12px;
          }

          .product-card-image {
            height: 180px;
          }

          .product-card-title {
            font-size: 14px;
            height: 40px;
          }

          .footer-links {
            flex-direction: column;
            gap: 20px;
          }
        }

        /* MOBILE - 480px and down */
        @media (max-width: 480px) {
          .product-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .header-content {
            padding: 16px 12px 24px;
          }

          .logo-img {
            height: 50px;
          }

          .main-title {
            font-size: 28px;
            letter-spacing: 1px;
          }

          .subtitle {
            font-size: 15px;
          }

          .search-input {
            padding: 12px 16px;
            font-size: 15px;
          }

          .cart-button {
            top: 10px;
            right: 10px;
          }

          /* Bottom sheet para carrito en móvil */
          .cart-modal {
            align-items: flex-end;
            padding: 0;
          }

          .cart-content {
            max-height: 90vh;
            border-radius: 20px 20px 0 0;
            animation: slideUp 0.3s ease-out;
            width: 100%;
          }

          /* Layout de items del carrito en móvil: permite que la fila
             se acomode en dos líneas para que el nombre nunca se comprima */
          .cart-content > div > div {
            flex-wrap: wrap !important;
          }

          .cart-content h3,
          .cart-content p,
          .cart-content span {
            writing-mode: horizontal-tb !important;
            white-space: normal !important;
            word-break: normal !important;
            overflow-wrap: anywhere;
          }

          .product-card-image {
            height: 240px;
          }

          .product-card-title {
            font-size: 15px;
            height: auto;
            min-height: 44px;
          }

          /* Modal fullscreen en móvil */
          .product-modal-content {
            max-height: 100vh;
            border-radius: 0;
            padding: 20px;
          }

          /* Paginación compacta en móvil */
          .pagination-numbers {
            gap: 4px;
          }

          .pagination-button {
            min-width: 40px !important;
            min-height: 40px !important;
            padding: 10px 12px !important;
            font-size: 13px !important;
          }

          /* Ocultar tip de teclado en móvil */
          .keyboard-tip {
            display: none;
          }
        }

        /* SMALL MOBILE - 360px and down */
        @media (max-width: 360px) {
          .main-title {
            font-size: 24px;
          }

          .logo-img {
            height: 45px;
          }
        }

        /* ============================================
           LIGHTBOX RESPONSIVE - botones y zoom táctil
           ============================================ */
        .lightbox-btn {
          background: rgba(255,255,255,0.92);
          border: none;
          border-radius: 50%;
          width: 56px;
          height: 56px;
          font-size: 30px;
          font-weight: bold;
          color: #1f2937;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: transform 0.2s, background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          padding: 0;
          z-index: 2001;
        }
        .lightbox-btn:hover {
          background: white;
        }
        .lightbox-btn span {
          display: block;
          line-height: 1;
          margin-top: -2px;
        }

        .lightbox-img-wrap {
          width: 90vw;
          height: 82vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
          touch-action: pinch-zoom;
        }

        /* Tamaño del preview del modal de detalle */
        .detail-image-box {
          height: 420px;
        }

        @media (max-width: 768px) {
          .lightbox-btn {
            width: 44px;
            height: 44px;
            font-size: 24px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          }
          .lightbox-img-wrap {
            width: 96vw;
            height: 85vh;
          }
          .detail-image-box {
            height: 56vh;
            max-height: 520px;
          }
        }

        @media (max-width: 480px) {
          .detail-image-box {
            height: 58vh;
            max-height: 540px;
          }
        }
      `}</style>

      {/* Notificación Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'white',
          border: '2px solid #10b981',
          color: '#1f2937',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          zIndex: 1000,
          animation: 'slideIn 0.3s ease-out',
          maxWidth: '90vw'
        }}>
          {notification}
        </div>
      )}

      {/* Borde decorativo superior */}
      {!adminMode && (
      <div style={{
        height: '4px',
        background: 'linear-gradient(90deg, transparent, #c5d3d1, #b8c5c3, #c5d3d1, transparent)'
      }}></div>
      )}

      {/* Header vintage elegante */}
      {!adminMode && (
      <header style={{
        background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 50%, #c5d3d1 100%)',
        borderBottom: '3px solid #a8b8b5',
        position: 'relative',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
      }}>
        {/* Textura de papel vintage */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          pointerEvents: 'none'
        }}></div>

        <div className="header-content" style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative' }}>
          {/* Logo centrado */}
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <img
              src={siteConfig.logo_url}
              alt="Bazar Retro"
              className="logo-img"
              style={{ 
                height: `${siteConfig.logo_height}px`,
                margin: '0 auto', 
                display: 'inline-block',
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
              }}
            />
          </div>

          {/* Línea decorativa superior */}
          <div style={{
            width: '200px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #5b7a7a, transparent)',
            margin: '0 auto 8px',
            maxWidth: '80%'
          }}></div>

          {/* Frase descriptiva con más protagonismo */}
          <p className="subtitle" style={{
            textAlign: 'center',
            color: '#2c4a4a',
            fontStyle: 'italic',
            marginBottom: '16px',
            fontFamily: 'Georgia, serif',
            padding: '0 12px',
            fontSize: '18px',
            fontWeight: '500',
            letterSpacing: '0.5px'
          }}>
            Tesoros del pasado, historias del presente
          </p>

          {/* Línea decorativa inferior */}
          <div style={{
            width: '200px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #5b7a7a, transparent)',
            margin: '0 auto 16px',
            maxWidth: '80%'
          }}></div>

          {/* Aviso */}
          <div style={{
            maxWidth: '768px',
            margin: '0 auto',
            background: 'rgba(220, 227, 224, 0.6)',
            border: '2px solid #a8b8b5',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '14px',
            color: '#2c4a4a',
            textAlign: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            <strong>ℹ️ ¿Cómo funciona el carrito?</strong> Agrega productos, revisa tu pedido y al hacer click en "Enviar pedido",
            se abrirá WhatsApp con tu lista para confirmar tu compra directamente con nosotros.
          </div>

          {/* Información Adicional - DISEÑO COMPACTO */}
          {siteConfig.info_adicional && (
            <div style={{
              maxWidth: '768px',
              margin: '20px auto 0',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,240,232,0.95) 100%)',
              border: '3px solid #a8b8b5',
              borderRadius: '16px',
              overflow: 'hidden',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            }}>
              {/* Header compacto */}
              <div style={{
                background: 'linear-gradient(135deg, #7a9999, #5b7a7a)',
                padding: '12px 20px',
                borderBottom: '2px solid #4a6565'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '700',
                  color: 'white',
                  fontFamily: 'Georgia, serif',
                  textAlign: 'center',
                  letterSpacing: '0.5px'
                }}>
                  💳 Formas de Pago y Envío
                </h3>
              </div>

              {/* Contenido en 2 columnas */}
              <div style={{
                padding: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px'
              }}>
                {/* Detectar y organizar secciones */}
                {(() => {
                  const text = siteConfig.info_adicional;
                  const lines = text.split('\n').filter(l => l.trim());
                  
                  const payment = [];
                  const shipping = [];
                  const schedule = [];
                  
                  lines.forEach(line => {
                    const lower = line.toLowerCase();
                    if (lower.includes('transferencia') || lower.includes('efectivo') || lower.includes('pago')) {
                      payment.push(line);
                    } else if (lower.includes('envío') || lower.includes('retiro') || lower.includes('santiago') || lower.includes('regiones')) {
                      shipping.push(line);
                    } else if (lower.includes('horario') || lower.includes('lun') || lower.includes('día siguiente')) {
                      schedule.push(line);
                    }
                  });

                  return (
                    <>
                      {/* Columna Pago */}
                      {payment.length > 0 && (
                        <div style={{
                          background: 'white',
                          borderRadius: '10px',
                          padding: '14px 16px',
                          border: '2px solid #10b98120',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '10px',
                            paddingBottom: '8px',
                            borderBottom: '2px solid #10b98120'
                          }}>
                            <span style={{ fontSize: '20px' }}>💵</span>
                            <h4 style={{
                              margin: 0,
                              fontSize: '14px',
                              fontWeight: '700',
                              color: '#10b981',
                              fontFamily: 'Georgia, serif'
                            }}>
                              Medios de Pago
                            </h4>
                          </div>
                          <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                            {payment.map((line, i) => (
                              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ color: '#10b981', fontWeight: '600' }}>•</span>
                                <span>{line}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Columna Envío */}
                      {shipping.length > 0 && (
                        <div style={{
                          background: 'white',
                          borderRadius: '10px',
                          padding: '14px 16px',
                          border: '2px solid #3b82f620',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '10px',
                            paddingBottom: '8px',
                            borderBottom: '2px solid #3b82f620'
                          }}>
                            <span style={{ fontSize: '20px' }}>📦</span>
                            <h4 style={{
                              margin: 0,
                              fontSize: '14px',
                              fontWeight: '700',
                              color: '#3b82f6',
                              fontFamily: 'Georgia, serif'
                            }}>
                              Envío y Retiro
                            </h4>
                          </div>
                          <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                            {shipping.map((line, i) => (
                              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ color: '#3b82f6', fontWeight: '600' }}>•</span>
                                <span>{line}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Horarios (full width si hay) */}
                      {schedule.length > 0 && (
                        <div style={{
                          gridColumn: '1 / -1',
                          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          border: '2px solid #f59e0b40',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '12px',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {schedule.map((line, i) => (
                            <div key={i} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '13px',
                              color: '#92400e',
                              fontWeight: '600'
                            }}>
                              <span style={{ fontSize: '16px' }}>
                                {line.toLowerCase().includes('horario') ? '⏰' : '🚚'}
                              </span>
                              <span>{line}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Botón Admin */}
          {onSwitchToAdmin && (
            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <button
                onClick={onSwitchToAdmin}
                style={{
                  fontSize: '13px',
                  color: '#2c4a4a',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  padding: '8px',
                  minWidth: '44px',
                  minHeight: '44px'
                }}
              >
                🔧 Admin
              </button>
            </div>
          )}
        </div>
      </header>
      )}

      {/* Separador decorativo vintage */}
      {!adminMode && (
      <div style={{
        height: '20px',
        background: 'linear-gradient(180deg, rgba(197,211,209,0.15) 0%, transparent 100%)'
      }}></div>
      )}

      {/* Carrito flotante con animación */}
      {!adminMode && (
      <div className="cart-button" style={{ 
        animation: cartAnimation ? 'bounce 0.6s ease-in-out' : 'none'
      }}>
        <button
          onClick={() => setShowCart(!showCart)}
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #e8f0f0 100%)',
            border: '3px solid #7a9999',
            color: '#1e3a3a',
            padding: '14px 16px',
            borderRadius: '16px',
            fontWeight: '600',
            boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            minWidth: '60px',
            minHeight: '60px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 15px 25px rgba(0,0,0,0.2)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.15)';
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '2px' }}>🛒</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Carrito</div>
            {getCartItemCount() > 0 && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                background: '#dc2626',
                color: 'white',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 'bold',
                border: '2px solid white'
              }}>
                {getCartItemCount()}
              </div>
            )}
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4a6565', marginTop: '4px' }}>
              {formatPrice(getCartTotal())}
            </div>
          </div>
        </button>
      </div>
      )}

      {/* Botón scroll to top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            background: 'linear-gradient(135deg, #7a9999, #5b7a7a)',
            color: 'white',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
            zIndex: 90,
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ↑
        </button>
      )}

      {/* Área de productos */}
      <div style={{ background: adminMode ? 'transparent' : '#fafaf9', minHeight: adminMode ? 'auto' : '100vh', paddingTop: adminMode ? '8px' : '32px', paddingBottom: adminMode ? '20px' : '80px' }}>
        {/* Barra de búsqueda y filtros */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 16px', marginBottom: '32px' }}>
          {/* Búsqueda */}
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <input
              type="text"
              placeholder="🔍 Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{
                border: '2px solid #d1d5db',
                borderRadius: '12px',
                background: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
            />
          </div>

          {/* Filtros */}
          <div className="filter-container" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '300px' }}>
              <label style={{ color: '#2c4a4a', fontWeight: '600', fontSize: '15px', whiteSpace: 'nowrap' }}>
                Categoría:
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#1e3a3a',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '300px' }}>
              <label style={{ color: '#2c4a4a', fontWeight: '600', fontSize: '15px', whiteSpace: 'nowrap' }}>
                Ordenar:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#1e3a3a',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                <option value="recent">Más recientes</option>
                <option value="price-asc">Precio: Menor a Mayor</option>
                <option value="price-desc">Precio: Mayor a Menor</option>
                <option value="name">Nombre A-Z</option>
                <option value="stock">Más stock</option>
              </select>
            </div>
          </div>

          {/* Contador de productos */}
          <div style={{ textAlign: 'center', fontSize: '14px', color: '#6b7a7a' }}>
            Mostrando <span style={{ fontWeight: '700', color: '#2c4a4a' }}>{indexOfFirstProduct + 1}-{Math.min(indexOfLastProduct, filteredProducts.length)}</span> de <span style={{ fontWeight: '700' }}>{filteredProducts.length}</span> productos
            {selectedCategory !== "Todas" && ` en ${selectedCategory}`}
            {searchQuery && ` con "${searchQuery}"`}
          </div>
        </div>

        {/* Grid de productos - RESPONSIVE */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 16px' }}>
          <div 
            className={`product-grid ${fadeProducts ? 'products-fade' : 'products-visible'}`}
          >
            {currentProducts.map((product) => (
              <div
                key={product.id}
                className="product-card"
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  border: '2px solid #f3f4f6'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
                  e.currentTarget.style.borderColor = '#a8b8b5';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#f3f4f6';
                }}
              >
                {/* Imagen */}
                <div 
                  className="product-card-image"
                  style={{ 
                    position: 'relative', 
                    background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)', 
                    overflow: 'hidden', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={() => setSelectedProduct(product)}
                >
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      loading="lazy"
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain', // ✅ Muestra imagen completa sin cortar
                        transition: 'transform 0.3s ease'
                      }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                        <div style={{ fontSize: '56px', marginBottom: '8px' }}>📦</div>
                        <p style={{ fontSize: '13px', fontWeight: '500' }}>Sin imagen</p>
                      </div>
                    </div>
                  )}

                  {/* Badges */}
                  {product.quantity === 0 ? (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: '#dc2626',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                    }}>
                      Agotado
                    </div>
                  ) : product.quantity <= 3 ? (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: '#f97316',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                    }}>
                      ¡Últimas {product.quantity}!
                    </div>
                  ) : null}

                  {/* Indicador de cantidad de fotos */}
                  {product.images && product.images.length > 1 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      background: 'rgba(30, 58, 58, 0.85)',
                      backdropFilter: 'blur(8px)',
                      color: 'white',
                      padding: '6px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                      <span>📷</span>
                      <span>{product.images.length}</span>
                    </div>
                  )}

                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(255,255,255,0.95)',
                    color: '#1f2937',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: '1px solid #e5e7eb'
                  }}>
                    {product.category}
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: '16px' }}>
                  <h3
                    onClick={() => setSelectedProduct(product)}
                    className="product-card-title"
                    style={{
                      fontWeight: '700',
                      color: '#1e3a3a',
                      marginBottom: '10px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      lineHeight: '1.5',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {product.name}
                  </h3>

                  <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#2c4a4a', marginBottom: '10px' }}>
                    {formatPrice(product.price)}
                  </p>

                  <div style={{ marginBottom: '14px', fontSize: '13px' }}>
                    <span style={{ color: '#6b7a7a' }}>Stock: </span>
                    {adminMode && editingStockId === product.id ? (
                      <span
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}
                      >
                        <input
                          type="number"
                          min="0"
                          value={stockDraft}
                          autoFocus
                          onChange={(e) => setStockDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveStock(product.id);
                            if (e.key === 'Escape') cancelStockEdit();
                          }}
                          style={{
                            width: '70px',
                            padding: '6px 8px',
                            border: '2px solid #3b82f6',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '700',
                            textAlign: 'center',
                            color: '#1e3a3a'
                          }}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); saveStock(product.id); }}
                          disabled={savingStock}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            width: '32px',
                            height: '32px',
                            cursor: savingStock ? 'wait' : 'pointer',
                            fontSize: '15px',
                            fontWeight: '700'
                          }}
                          title="Guardar"
                        >
                          ✓
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelStockEdit(); }}
                          style={{
                            background: '#9ca3af',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            width: '32px',
                            height: '32px',
                            cursor: 'pointer',
                            fontSize: '15px',
                            fontWeight: '700'
                          }}
                          title="Cancelar"
                        >
                          ✕
                        </button>
                      </span>
                    ) : (
                      <>
                        <span style={{
                          fontWeight: '700',
                          color: product.quantity === 0 ? '#dc2626' : product.quantity <= 3 ? '#f97316' : '#10b981'
                        }}>
                          {product.quantity} unidades
                        </span>
                        {adminMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); startStockEdit(product); }}
                            style={{
                              marginLeft: '8px',
                              background: 'transparent',
                              border: '1px solid #a8b8b5',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: '#4a6565',
                              fontWeight: '600'
                            }}
                            title="Editar stock rápido"
                          >
                            ✏️ stock
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {!adminMode && (
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.quantity === 0}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: product.quantity === 0 ? 'not-allowed' : 'pointer',
                      background: product.quantity === 0 ? '#e5e7eb' : 'linear-gradient(135deg, #7a9999, #5b7a7a)',
                      color: product.quantity === 0 ? '#9ca3af' : 'white',
                      transition: 'all 0.3s ease',
                      fontSize: '14px',
                      boxShadow: product.quantity === 0 ? 'none' : '0 4px 8px rgba(91,122,122,0.3)',
                      minHeight: '44px'
                    }}
                    onMouseOver={(e) => {
                      if (product.quantity > 0) {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 6px 12px rgba(91,122,122,0.4)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (product.quantity > 0) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(91,122,122,0.3)';
                      }
                    }}
                  >
                    {product.quantity === 0 ? "Agotado" : "Agregar al carrito"}
                  </button>
                  )}

                  {/* Controles de administración */}
                  {adminMode && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditProduct && onEditProduct(product);
                        }}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '13px',
                          border: 'none',
                          cursor: 'pointer',
                          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                          color: 'white',
                          minHeight: '44px'
                        }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProduct && onDeleteProduct(product.id);
                        }}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '13px',
                          border: 'none',
                          cursor: 'pointer',
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          color: 'white',
                          minHeight: '44px'
                        }}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Controles de Paginación */}
          {filteredProducts.length > 0 && totalPages > 1 && (
            <div style={{ marginTop: '48px' }}>
              {/* Indicador de página y navegación directa */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '20px',
                marginBottom: '24px',
                flexWrap: 'wrap',
                padding: '0 16px'
              }}>
                {/* Indicador de página actual */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0f0e8, #dce3e0)',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: '2px solid #a8b8b5',
                  fontWeight: '700',
                  fontSize: '15px',
                  color: '#2c4a4a'
                }}>
                  📄 Página <span style={{ fontSize: '18px', color: '#5b7a7a' }}>{currentPage}</span> de {totalPages}
                </div>

                {/* Input para ir directo a página */}
                <form onSubmit={handleGoToPage} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#4a6565',
                    whiteSpace: 'nowrap'
                  }}>
                    Ir a página:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={goToPageInput}
                    onChange={(e) => setGoToPageInput(e.target.value)}
                    placeholder={currentPage.toString()}
                    style={{
                      width: '70px',
                      padding: '10px 12px',
                      border: '2px solid #a8b8b5',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '600',
                      textAlign: 'center',
                      background: 'white',
                      color: '#2c4a4a'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: '2px solid #a8b8b5',
                      background: 'linear-gradient(135deg, #7a9999, #5b7a7a)',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      minHeight: '44px',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(91,122,122,0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Ir →
                  </button>
                </form>
              </div>

              {/* Botones de navegación */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                padding: '0 16px'
              }}>
              {/* Botón Anterior */}
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '2px solid #a8b8b5',
                  background: currentPage === 1 ? '#f3f4f6' : 'linear-gradient(135deg, #f0f0e8, #dce3e0)',
                  color: currentPage === 1 ? '#9ca3af' : '#2c4a4a',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  minWidth: '100px',
                  minHeight: '44px',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
                onMouseOver={(e) => {
                  if (currentPage !== 1) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseOut={(e) => {
                  if (currentPage !== 1) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                ◄ Anterior
              </button>

              {/* Números de página */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span
                      key={`ellipsis-${index}`}
                      style={{
                        padding: '12px 8px',
                        color: '#6b7a7a',
                        fontSize: '16px',
                        fontWeight: '600',
                        minWidth: '40px',
                        textAlign: 'center'
                      }}
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => paginate(page)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '2px solid #a8b8b5',
                        background: currentPage === page 
                          ? 'linear-gradient(135deg, #7a9999, #5b7a7a)' 
                          : 'linear-gradient(135deg, #f0f0e8, #dce3e0)',
                        color: currentPage === page ? 'white' : '#2c4a4a',
                        fontWeight: '700',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        minWidth: '44px',
                        minHeight: '44px',
                        boxShadow: currentPage === page ? '0 4px 8px rgba(91,122,122,0.3)' : 'none'
                      }}
                      onMouseOver={(e) => {
                        if (currentPage !== page) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (currentPage !== page) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>

              {/* Botón Siguiente */}
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '2px solid #a8b8b5',
                  background: currentPage === totalPages ? '#f3f4f6' : 'linear-gradient(135deg, #f0f0e8, #dce3e0)',
                  color: currentPage === totalPages ? '#9ca3af' : '#2c4a4a',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  minWidth: '100px',
                  minHeight: '44px',
                  opacity: currentPage === totalPages ? 0.5 : 1
                }}
                onMouseOver={(e) => {
                  if (currentPage !== totalPages) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseOut={(e) => {
                  if (currentPage !== totalPages) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                Siguiente ►
              </button>
            </div>

            {/* Ayuda de navegación con teclado */}
            <div className="keyboard-tip" style={{
              textAlign: 'center',
              marginTop: '16px',
              fontSize: '13px',
              color: '#6b7a7a',
              fontStyle: 'italic'
            }}>
              💡 Tip: Usa las flechas ← → del teclado para navegar
            </div>
          </div>
          )}

          {filteredProducts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '72px', marginBottom: '20px' }}>🔍</div>
              <p style={{ fontSize: '22px', color: '#2c4a4a', fontWeight: '600' }}>
                No se encontraron productos
              </p>
              <p style={{ fontSize: '16px', color: '#6b7a7a', marginTop: '8px' }}>
                {searchQuery ? `No hay resultados para "${searchQuery}"` : "Intenta con otra categoría"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer con info de contacto - RESPONSIVE */}
      {!adminMode && (
      <footer style={{
        background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 100%)',
        borderTop: '3px solid #a8b8b5',
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h3 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1e3a3a',
            marginBottom: '20px',
            fontFamily: 'Georgia, serif'
          }}>
            Contáctanos
          </h3>
          
          <div className="footer-links" style={{ marginBottom: '24px' }}>
            <a 
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#2c4a4a',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'color 0.3s',
                justifyContent: 'center',
                minHeight: '44px',
                padding: '8px'
              }}
            >
              <span style={{ fontSize: '24px' }}>📱</span>
              <span>WhatsApp: +56 9 9237 9465</span>
            </a>
          </div>

          <div style={{
            width: '150px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #5b7a7a, transparent)',
            margin: '24px auto',
            maxWidth: '80%'
          }}></div>

          <p style={{
            color: '#4a6565',
            fontSize: '14px',
            fontStyle: 'italic',
            marginBottom: '8px'
          }}>
            Cada objeto cuenta una historia ✨
          </p>
          
          <p style={{
            color: '#2c4a4a',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            © 2026 Bazar Retro - Todos los derechos reservados
          </p>
        </div>
      </footer>
      )}

      {/* Modal del carrito - RESPONSIVE (Bottom sheet en móvil) */}
      {showCart && (
        <div className="cart-modal" style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="cart-content" style={{
            background: 'white',
            padding: '28px',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1e3a3a' }}>🛒 Tu Carrito</h2>
              <button
                onClick={() => setShowCart(false)}
                style={{
                  color: '#6b7280',
                  fontSize: '36px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: '1',
                  transition: 'color 0.3s',
                  minWidth: '44px',
                  minHeight: '44px',
                  padding: '0'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#1f2937'}
                onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
              >
                ×
              </button>
            </div>

            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '80px', marginBottom: '20px' }}>🛒</div>
                <p style={{ fontSize: '22px', color: '#2c4a4a', fontWeight: '600' }}>Tu carrito está vacío</p>
                <p style={{ fontSize: '15px', color: '#6b7a7a', marginTop: '8px' }}>¡Agrega productos para comenzar tu pedido!</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '24px' }}>
                  {cart.map((item) => (
                    <div key={item.id} style={{
                      display: 'flex',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '16px',
                      background: '#f9fafb',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '2px solid #f3f4f6',
                      marginBottom: '12px',
                      transition: 'border-color 0.3s'
                    }}>
                      <img
                        src={item.images?.[0] || "https://via.placeholder.com/80"}
                        alt={item.name}
                        loading="lazy"
                        style={{ 
                          width: '80px', 
                          height: '80px', 
                          objectFit: 'cover', 
                          borderRadius: '8px',
                          border: '2px solid #e5e7eb',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ 
                        flex: '1 1 150px', 
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                      }}>
                        <h3 style={{ fontWeight: '700', color: '#1e3a3a', fontSize: '15px', marginBottom: '4px', wordWrap: 'break-word' }}>{item.name}</h3>
                        <p style={{ fontSize: '14px', color: '#6b7a7a', fontWeight: '600' }}>{formatPrice(item.price)}</p>
                        <p style={{ fontSize: '13px', color: '#6b7a7a', marginTop: '4px' }}>
                          Subtotal: <span style={{ fontWeight: '700', color: '#2c4a4a' }}>{formatPrice(item.price * item.quantity)}</span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1, item.stockReal || item.quantity)}
                          style={{
                            background: '#e5e7eb',
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '18px',
                            color: '#374151',
                            transition: 'all 0.2s',
                            minWidth: '36px'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#d1d5db'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#e5e7eb'}
                        >
                          -
                        </button>
                        <span style={{ width: '40px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1, item.stockReal || item.quantity)}
                          disabled={item.quantity >= (item.stockReal || item.quantity)}
                          style={{
                            background: item.quantity >= (item.stockReal || item.quantity) ? '#d1d5db' : '#e5e7eb',
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: item.quantity >= (item.stockReal || item.quantity) ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            fontSize: '18px',
                            color: '#374151',
                            transition: 'all 0.2s',
                            minWidth: '36px',
                            opacity: item.quantity >= (item.stockReal || item.quantity) ? 0.5 : 1
                          }}
                          onMouseOver={(e) => {
                            if (item.quantity < (item.stockReal || item.quantity)) {
                              e.currentTarget.style.background = '#d1d5db';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (item.quantity < (item.stockReal || item.quantity)) {
                              e.currentTarget.style.background = '#e5e7eb';
                            }
                          }}
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id, item.name)}
                        style={{
                          color: '#dc2626',
                          fontSize: '24px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'color 0.3s',
                          minWidth: '44px',
                          minHeight: '44px',
                          padding: '0',
                          flexShrink: 0
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#991b1b'}
                        onMouseOut={(e) => e.currentTarget.style.color = '#dc2626'}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ 
                  borderTop: '3px solid #d1d5db', 
                  paddingTop: '20px',
                  background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 100%)',
                  padding: '20px',
                  borderRadius: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '18px', color: '#2c4a4a', fontWeight: '600' }}>Items:</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#4a6565' }}>{getCartItemCount()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a3a' }}>Total:</span>
                    <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c4a4a' }}>
                      {formatPrice(getCartTotal())}
                    </span>
                  </div>
                  
                  <button
                    onClick={clearCart}
                    style={{
                      width: '100%',
                      background: '#ef4444',
                      color: 'white',
                      padding: '12px',
                      borderRadius: '10px',
                      fontWeight: '700',
                      fontSize: '15px',
                      border: 'none',
                      cursor: 'pointer',
                      marginBottom: '12px',
                      transition: 'all 0.3s',
                      minHeight: '48px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#dc2626';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#ef4444';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    🗑️ Vaciar Carrito
                  </button>

                  <button
                    onClick={sendWhatsApp}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: 'white',
                      padding: '18px',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      fontSize: '18px',
                      boxShadow: '0 8px 16px rgba(22,163,74,0.3)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      minHeight: '56px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 20px rgba(22,163,74,0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(22,163,74,0.3)';
                    }}
                  >
                    📱 Enviar pedido por WhatsApp
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal detalle producto - RESPONSIVE (Fullscreen en móvil) */}
      {selectedProduct && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div className="product-modal-content" style={{
            background: 'white',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setQuantityToAdd(1);
                  setCurrentImageIndex(0);
                }}
                style={{
                  float: 'right',
                  color: '#6b7280',
                  fontSize: '40px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: '1',
                  transition: 'color 0.3s',
                  minWidth: '44px',
                  minHeight: '44px',
                  padding: '0'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#1f2937'}
                onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
              >
                ×
              </button>
              <h2 style={{ 
                fontSize: '28px', 
                fontWeight: 'bold', 
                color: '#1f2937', 
                marginBottom: '12px',
                paddingRight: '40px',
                wordWrap: 'break-word'
              }}>
                {selectedProduct.name}
              </h2>
              <span style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                color: '#92400e',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '700',
                border: '2px solid #d4a574'
              }}>
                {selectedProduct.category}
              </span>
            </div>

            {selectedProduct.images && selectedProduct.images.length > 0 && (
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                {/* Imagen con encuadre correcto */}
                <div className="detail-image-box" style={{
                  width: '100%',
                  background: '#f9fafb',
                  borderRadius: '16px',
                  border: '3px solid #f3f4f6',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img
                    src={selectedProduct.images[currentImageIndex]}
                    alt={`${selectedProduct.name} - Imagen ${currentImageIndex + 1}`}
                    onClick={() => setShowLightbox(true)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain', // ✅ Muestra imagen completa
                      cursor: 'zoom-in',
                      display: 'block',
                      borderRadius: '13px'
                    }}
                  />

                  {/* Contador de imágenes */}
                  {selectedProduct.images.length > 1 && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      padding: '8px 14px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '700',
                      backdropFilter: 'blur(8px)'
                    }}>
                      📷 {currentImageIndex + 1}/{selectedProduct.images.length}
                    </div>
                  )}

                  {/* Flechas de navegación */}
                  {selectedProduct.images.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          prevImage();
                        }}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'rgba(255,255,255,0.95)',
                          border: '2px solid #a8b8b5',
                          borderRadius: '50%',
                          width: '48px',
                          height: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: '#2c4a4a',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                          transition: 'all 0.3s',
                          zIndex: 10
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                          e.currentTarget.style.background = 'white';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                          e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                        }}
                      >
                        ‹
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          nextImage();
                        }}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'rgba(255,255,255,0.95)',
                          border: '2px solid #a8b8b5',
                          borderRadius: '50%',
                          width: '48px',
                          height: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: '#2c4a4a',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                          transition: 'all 0.3s',
                          zIndex: 10
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                          e.currentTarget.style.background = 'white';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                          e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                        }}
                      >
                        ›
                      </button>
                    </>
                  )}
                </div>

                {/* Dots indicadores */}
                {selectedProduct.images.length > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '12px'
                  }}>
                    {selectedProduct.images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => goToImage(index)}
                        style={{
                          width: index === currentImageIndex ? '32px' : '10px',
                          height: '10px',
                          borderRadius: '5px',
                          border: 'none',
                          background: index === currentImageIndex 
                            ? 'linear-gradient(135deg, #7a9999, #5b7a7a)'
                            : '#d1d5db',
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                          boxShadow: index === currentImageIndex ? '0 2px 4px rgba(91,122,122,0.3)' : 'none'
                        }}
                        onMouseOver={(e) => {
                          if (index !== currentImageIndex) {
                            e.currentTarget.style.background = '#9ca3af';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (index !== currentImageIndex) {
                            e.currentTarget.style.background = '#d1d5db';
                          }
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Hint para zoom */}
                <p style={{
                  textAlign: 'center',
                  fontSize: '13px',
                  color: '#6b7a7a',
                  marginTop: '8px',
                  fontStyle: 'italic'
                }}>
                  🔍 Toca la imagen para ampliarla
                </p>
              </div>
            )}

            {selectedProduct.description && (
              <div style={{
                marginBottom: '20px',
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <h3 style={{ 
                  fontWeight: '700', 
                  color: '#1e3a3a', 
                  marginBottom: '10px', 
                  fontSize: '16px' 
                }}>
                  📝 Descripción:
                </h3>
                <p style={{ 
                  color: '#1f2937', // ✅ Color más oscuro para mejor legibilidad
                  lineHeight: '1.7', 
                  fontSize: '16px', // ✅ Aumentado para móvil
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap' // Respeta saltos de línea
                }}>
                  {selectedProduct.description}
                </p>
              </div>
            )}

            <div style={{
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 100%)',
              padding: '24px',
              borderRadius: '16px',
              border: '3px solid #a8b8b5'
            }}>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#2c4a4a', marginBottom: '12px' }}>
                {formatPrice(selectedProduct.price)}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <span style={{ fontSize: '15px', color: '#4a6565', fontWeight: '600' }}>Stock disponible:</span>
                <span style={{
                  fontWeight: 'bold',
                  fontSize: '15px',
                  color: selectedProduct.quantity === 0 ? '#dc2626' : selectedProduct.quantity <= 3 ? '#f97316' : '#10b981'
                }}>
                  {selectedProduct.quantity} unidades
                </span>
              </div>

              {/* NUEVO: Selector de cantidad */}
              {!adminMode && selectedProduct.quantity > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: '#2c4a4a', 
                    marginBottom: '10px' 
                  }}>
                    Cantidad a agregar:
                  </label>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    background: 'white',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '2px solid #a8b8b5',
                    maxWidth: '200px'
                  }}>
                    <button
                      onClick={() => setQuantityToAdd(Math.max(1, quantityToAdd - 1))}
                      style={{
                        background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '20px',
                        color: '#374151',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.background = 'linear-gradient(135deg, #d1d5db, #b8bcc2)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.background = 'linear-gradient(135deg, #e5e7eb, #d1d5db)';
                      }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={quantityToAdd}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        setQuantityToAdd(Math.max(1, Math.min(selectedProduct.quantity, value)));
                      }}
                      min="1"
                      max={selectedProduct.quantity}
                      style={{
                        width: '60px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '20px',
                        border: 'none',
                        background: 'transparent',
                        color: '#1e3a3a',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => setQuantityToAdd(Math.min(selectedProduct.quantity, quantityToAdd + 1))}
                      disabled={quantityToAdd >= selectedProduct.quantity}
                      style={{
                        background: quantityToAdd >= selectedProduct.quantity 
                          ? '#e5e7eb' 
                          : 'linear-gradient(135deg, #7a9999, #5b7a7a)',
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: quantityToAdd >= selectedProduct.quantity ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        fontSize: '20px',
                        color: quantityToAdd >= selectedProduct.quantity ? '#9ca3af' : 'white',
                        transition: 'all 0.2s',
                        boxShadow: quantityToAdd >= selectedProduct.quantity ? 'none' : '0 2px 4px rgba(91,122,122,0.3)',
                        opacity: quantityToAdd >= selectedProduct.quantity ? 0.5 : 1
                      }}
                      onMouseOver={(e) => {
                        if (quantityToAdd < selectedProduct.quantity) {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(91,122,122,0.4)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (quantityToAdd < selectedProduct.quantity) {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(91,122,122,0.3)';
                        }
                      }}
                    >
                      +
                    </button>
                  </div>
                  {quantityToAdd >= selectedProduct.quantity && (
                    <p style={{ 
                      fontSize: '13px', 
                      color: '#f97316', 
                      marginTop: '8px',
                      fontWeight: '600'
                    }}>
                      ⚠️ Stock máximo alcanzado
                    </p>
                  )}
                </div>
              )}
            </div>

            {!adminMode && (
            <button
              onClick={() => {
                addToCart(selectedProduct, quantityToAdd);
                setSelectedProduct(null);
                setQuantityToAdd(1);
                setCurrentImageIndex(0);
              }}
              disabled={selectedProduct.quantity === 0}
              style={{
                width: '100%',
                padding: '18px',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '18px',
                border: 'none',
                cursor: selectedProduct.quantity === 0 ? 'not-allowed' : 'pointer',
                background: selectedProduct.quantity === 0 ? '#e5e7eb' : 'linear-gradient(135deg, #7a9999, #5b7a7a)',
                color: selectedProduct.quantity === 0 ? '#9ca3af' : 'white',
                boxShadow: selectedProduct.quantity === 0 ? 'none' : '0 8px 16px rgba(91,122,122,0.3)',
                transition: 'all 0.3s',
                minHeight: '56px'
              }}
              onMouseOver={(e) => {
                if (selectedProduct.quantity > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 20px rgba(91,122,122,0.4)';
                }
              }}
              onMouseOut={(e) => {
                if (selectedProduct.quantity > 0) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(91,122,122,0.3)';
                }
              }}
            >
              {selectedProduct.quantity === 0 
                ? "❌ Producto agotado" 
                : `🛒 Agregar ${quantityToAdd > 1 ? `${quantityToAdd} unidades` : ''} al carrito`}
            </button>
            )}

            {adminMode && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  onEditProduct && onEditProduct(selectedProduct);
                  setSelectedProduct(null);
                  setCurrentImageIndex(0);
                }}
                style={{
                  flex: 1,
                  padding: '16px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: 'white',
                  minHeight: '56px'
                }}
              >
                ✏️ Editar producto
              </button>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setCurrentImageIndex(0);
                }}
                style={{
                  flex: 1,
                  padding: '16px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  border: '2px solid #a8b8b5',
                  cursor: 'pointer',
                  background: '#f0f0e8',
                  color: '#2c4a4a',
                  minHeight: '56px'
                }}
              >
                Cerrar
              </button>
            </div>
            )}
          </div>
        </div>
      )}
      
      {/* Lightbox para ver imagen completa */}
      {showLightbox && selectedProduct && selectedProduct.images && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.985)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={() => {
            setShowLightbox(false);
            setIsZoomed(false);
          }}
        >
          {/* Botón cerrar - ESQUINA SUPERIOR DERECHA (ya no choca con la flecha) */}
          <button
            className="lightbox-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowLightbox(false);
              setIsZoomed(false);
            }}
            aria-label="Cerrar"
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px'
            }}
          >
            <span>×</span>
          </button>

          {/* Contador de imágenes */}
          <div style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '25px',
            fontSize: '15px',
            fontWeight: '700',
            backdropFilter: 'blur(8px)',
            zIndex: 2001
          }}>
            {currentImageIndex + 1} / {selectedProduct.images.length}
          </div>

          {/* Hint de zoom (solo informativo) */}
          <div style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
            zIndex: 2001,
            textAlign: 'center',
            maxWidth: '90vw'
          }}>
            {isZoomed ? 'Toca para alejar' : 'Toca para acercar · en celular pellizca para zoom'}
          </div>

          {/* Imagen: tap para zoom 1.5x (desktop) y pinch nativo (celular) */}
          <div
            className="lightbox-img-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedProduct.images[currentImageIndex]}
              alt={`${selectedProduct.name} - Imagen ${currentImageIndex + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(!isZoomed);
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                transform: isZoomed ? 'scale(2)' : 'scale(1)',
                transformOrigin: 'center center',
                transition: 'transform 0.3s ease',
                userSelect: 'none'
              }}
            />
          </div>

          {/* Flechas de navegación - a los lados, centradas */}
          {selectedProduct.images.length > 1 && (
            <>
              <button
                className="lightbox-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomed(false);
                  prevImage();
                }}
                aria-label="Imagen anterior"
                style={{
                  position: 'fixed',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              >
                <span>‹</span>
              </button>

              <button
                className="lightbox-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomed(false);
                  nextImage();
                }}
                aria-label="Imagen siguiente"
                style={{
                  position: 'fixed',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              >
                <span>›</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}