import { useState } from "react";
import { supabase } from "./supabaseClient";
import CloudinaryUploader from "./CloudinaryUploader";

export default function ProductEditor({ product, onSave, onCancel, existingCategories = [] }) {
  const [formData, setFormData] = useState({
    name: product.name || "",
    description: product.description || "",
    quantity: product.quantity || 0,
    price: product.price || 0,
    category: product.category || "",
    images: product.images || [],
    videos: product.videos || [],
  });
  const [uploading, setUploading] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  // Combinar categorías existentes con opción "Otra..."
  // Si no hay categorías, usar valores por defecto
  const defaultCategories = ["Adornos", "Jarros", "Relojes de arena"];
  const categoriesToUse = existingCategories.length > 0 ? existingCategories : defaultCategories;
  const categories = [...categoriesToUse, "➕ Nueva categoría..."];

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si selecciona "Nueva categoría..."
    if (name === "category" && value === "➕ Nueva categoría...") {
      setShowCustomCategory(true);
      setCustomCategory("");
      return;
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: name === "quantity" || name === "price" ? Number(value) : value,
    }));
  };

  const handleCustomCategoryChange = (e) => {
    const value = e.target.value;
    setCustomCategory(value);
    setFormData((prev) => ({
      ...prev,
      category: value
    }));
  };

  // Funciones de video
  const addVideoUrl = () => {
    if (newVideoUrl.trim()) {
      setFormData((prev) => ({
        ...prev,
        videos: [...prev.videos, newVideoUrl.trim()],
      }));
      setNewVideoUrl("");
    }
  };

  const removeVideo = (index) => {
    setFormData((prev) => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return; // evita doble envío si ya está guardando

    setUploading(true);
    try {
      // onSave viene de App.jsx (createProduct / updateProduct), que son async
      // y devuelven una promesa, así que podemos esperar a que termine.
      await onSave(formData);
    } catch (err) {
      console.error("Error al guardar el producto:", err);
    } finally {
      // En guardado exitoso el modal se cierra (este componente se desmonta);
      // si hubo error, el modal queda abierto y el botón se reactiva.
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <style>{`
        /* RESPONSIVE STYLES */
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #d1d5db;
          border-radius: 8px;
          font-size: 15px;
          background: white;
          color: #1f2937;
          box-sizing: border-box;
          min-height: 44px;
        }

        .form-input option {
          color: #1f2937;
          background: white;
        }

        .form-input:focus {
          outline: none;
          border-color: #7c5c3b;
          box-shadow: 0 0 0 3px rgba(124, 92, 59, 0.1);
        }

        .form-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .image-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .form-buttons {
          display: flex;
          gap: 12px;
          padding-top: 16px;
          border-top: 2px solid #e5e7eb;
        }

        .grid-two-cols {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        /* TABLET - 768px and down */
        @media (max-width: 768px) {
          .image-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /* MOBILE - 480px and down */
        @media (max-width: 480px) {
          .form-input {
            font-size: 16px; /* Previene zoom en iOS */
            padding: 14px;
          }

          .image-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }

          .grid-two-cols {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .form-buttons {
            flex-direction: column;
            gap: 12px;
          }

          .form-group {
            margin-bottom: 16px;
          }
        }
      `}</style>

      <div className="form-group">
        <label className="form-label">
          Nombre del Producto
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="form-input"
          placeholder="Ej: Reloj de arena vintage"
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Descripción
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows="3"
          placeholder="Describe el producto, su historia, condición, detalles especiales..."
          className="form-input"
          style={{ 
            resize: 'vertical',
            minHeight: '80px'
          }}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
          Opcional - Ayuda a los clientes a conocer mejor el producto
        </p>
      </div>

      <div className="grid-two-cols">
        <div className="form-group">
          <label className="form-label">
            Cantidad
          </label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min="0"
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Precio (CLP)
          </label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            min="0"
            required
            className="form-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          Categoría
        </label>
        {showCustomCategory ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={customCategory}
              onChange={handleCustomCategoryChange}
              placeholder="Escribe nueva categoría..."
              className="form-input"
              autoFocus
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => {
                if (customCategory.trim()) {
                  setShowCustomCategory(false);
                } else {
                  setShowCustomCategory(false);
                  setFormData(prev => ({ ...prev, category: existingCategories[0] || "" }));
                }
              }}
              style={{
                padding: '10px 16px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                minHeight: '44px'
              }}
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustomCategory(false);
                setCustomCategory("");
                setFormData(prev => ({ ...prev, category: existingCategories[0] || "" }));
              }}
              style={{
                padding: '10px 16px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                minHeight: '44px'
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="form-input"
            style={{ cursor: 'pointer' }}
          >
            {formData.category && !categories.includes(formData.category) && (
              <option value={formData.category}>{formData.category}</option>
            )}
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Sección de Imágenes - CLOUDINARY */}
      <div className="form-group">
        <label className="form-label">
          Imágenes
        </label>
        
        <CloudinaryUploader
          currentImages={formData.images}
          onImagesUploaded={(newImages) => {
            setFormData(prev => ({
              ...prev,
              images: newImages
            }));
          }}
          maxImages={5}
          cloudName="dclf0c3ks"
          uploadPreset="bazar-retro-products"
        />
      </div>

      {/* Sección de Videos */}
      <div className="form-group">
        <label className="form-label">
          Videos (URLs de YouTube, Vimeo, etc.)
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input
            type="url"
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            placeholder="https://youtube.com/..."
            className="form-input"
            style={{ flex: '1', minWidth: '200px' }}
          />
          <button
            type="button"
            onClick={addVideoUrl}
            style={{
              padding: '12px 20px',
              background: '#7c5c3b',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.2s',
              minHeight: '44px',
              minWidth: '100px'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#5a4632'}
            onMouseOut={(e) => e.currentTarget.style.background = '#7c5c3b'}
          >
            Agregar
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {formData.videos.map((url, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f9fafb',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <span style={{
                flex: 1,
                fontSize: '13px',
                color: '#374151',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {url}
              </span>
              <button
                type="button"
                onClick={() => removeVideo(index)}
                style={{
                  color: '#ef4444',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  lineHeight: '1',
                  padding: '4px',
                  minWidth: '32px',
                  minHeight: '32px',
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#dc2626'}
                onMouseOut={(e) => e.currentTarget.style.color = '#ef4444'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="form-buttons">
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '14px 20px',
            border: '2px solid #d1d5db',
            color: '#374151',
            borderRadius: '8px',
            background: 'white',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '15px',
            transition: 'all 0.2s',
            minHeight: '48px'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
          onMouseOut={(e) => e.currentTarget.style.background = 'white'}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={uploading}
          style={{
            flex: 1,
            padding: '14px 20px',
            background: uploading ? '#9ca3af' : '#7c5c3b',
            color: 'white',
            borderRadius: '8px',
            border: 'none',
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '15px',
            transition: 'all 0.2s',
            minHeight: '48px',
            opacity: uploading ? 0.6 : 1
          }}
          onMouseOver={(e) => {
            if (!uploading) e.currentTarget.style.background = '#5a4632';
          }}
          onMouseOut={(e) => {
            if (!uploading) e.currentTarget.style.background = '#7c5c3b';
          }}
        >
          {uploading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}