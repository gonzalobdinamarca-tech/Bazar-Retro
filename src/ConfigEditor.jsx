import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function ConfigEditor() {
  const [config, setConfig] = useState({
    logo_url: '',
    logo_height: '60',
    info_adicional: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_config')
      .select('key, value');

    if (error) {
      console.error('Error loading config:', error);
      setMessage({ type: 'error', text: 'Error al cargar configuración' });
    } else {
      const configObj = {};
      data.forEach(item => {
        configObj[item.key] = item.value;
      });
      setConfig(configObj);
    }
    setLoading(false);
  };

  const handleChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Actualizar cada campo
      for (const [key, value] of Object.entries(config)) {
        const { error } = await supabase
          .from('site_config')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', key);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: '✅ Configuración guardada correctamente' });
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: '❌ Error al guardar configuración' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '60px 20px',
        color: '#6b7a7a'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚙️</div>
        <p style={{ fontSize: '18px', fontWeight: '600' }}>Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto'
    }}>
      <style>{`
        .config-label {
          display: block;
          font-size: 15px;
          font-weight: 700;
          color: #2c4a4a;
          margin-bottom: 8px;
        }

        .config-input,
        .config-textarea {
          width: 100%;
          padding: 14px 16px;
          border: 2px solid #d1d5db;
          border-radius: 10px;
          font-size: 15px;
          background: white;
          color: #1f2937;
          box-sizing: border-box;
          font-family: inherit;
          transition: all 0.3s;
        }

        .config-input:focus,
        .config-textarea:focus {
          outline: none;
          border-color: #7a9999;
          box-shadow: 0 0 0 3px rgba(122,153,153,0.1);
        }

        .config-textarea {
          resize: vertical;
          min-height: 200px;
          line-height: 1.6;
        }

        .config-hint {
          font-size: 13px;
          color: #6b7a7a;
          margin-top: 6px;
          font-style: italic;
        }

        .config-section {
          background: rgba(255,255,255,0.95);
          border: 3px solid #a8b8b5;
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .config-section-title {
          font-size: 20px;
          font-weight: bold;
          color: #1e3a3a;
          margin-bottom: 20px;
          font-family: Georgia, serif;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        @media (max-width: 768px) {
          .config-section {
            padding: 20px;
          }
        }
      `}</style>

      <h1 style={{
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#1e3a3a',
        marginBottom: '12px',
        fontFamily: 'Georgia, serif'
      }}>
        ⚙️ Configuración del Sitio
      </h1>
      <p style={{
        fontSize: '15px',
        color: '#4a6565',
        marginBottom: '32px'
      }}>
        Personaliza la apariencia y la información del catálogo público
      </p>

      {/* Mensaje de éxito/error */}
      {message && (
        <div style={{
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          border: `2px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '24px',
          fontSize: '15px',
          fontWeight: '600',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {message.text}
        </div>
      )}

      {/* Sección Logo */}
      <div className="config-section">
        <div className="config-section-title">
          <span>🖼️</span>
          <span>Logo del Header</span>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label className="config-label">
            URL de la Imagen
          </label>
          <input
            type="url"
            className="config-input"
            value={config.logo_url || ''}
            onChange={(e) => handleChange('logo_url', e.target.value)}
            placeholder="https://ejemplo.com/logo.png"
          />
          <p className="config-hint">
            Pega aquí la URL de tu logo (debe estar subido en Supabase Storage o un servicio externo)
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label className="config-label">
            Altura del Logo (en píxeles)
          </label>
          <input
            type="number"
            className="config-input"
            value={config.logo_height || '60'}
            onChange={(e) => handleChange('logo_height', e.target.value)}
            placeholder="60"
            min="30"
            max="150"
          />
          <p className="config-hint">
            Recomendado: entre 50 y 80 píxeles para mejor visualización
          </p>
        </div>

        {/* Preview del logo */}
        {config.logo_url && (
          <div style={{
            marginTop: '20px',
            padding: '20px',
            background: 'linear-gradient(135deg, #f0f0e8, #dce3e0)',
            borderRadius: '12px',
            border: '2px solid #e5e7eb'
          }}>
            <p style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#4a6565',
              marginBottom: '12px'
            }}>
              Vista Previa:
            </p>
            <img
              src={config.logo_url}
              alt="Preview logo"
              style={{
                height: `${config.logo_height || 60}px`,
                display: 'block',
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'block';
              }}
            />
            <p style={{
              display: 'none',
              color: '#dc2626',
              fontSize: '14px',
              fontWeight: '600',
              marginTop: '8px'
            }}>
              ⚠️ Error al cargar la imagen. Verifica que la URL sea correcta.
            </p>
          </div>
        )}
      </div>

      {/* Sección Información Adicional */}
      <div className="config-section">
        <div className="config-section-title">
          <span>📋</span>
          <span>Información Adicional</span>
        </div>

        <div>
          <label className="config-label">
            Texto Informativo
          </label>
          <textarea
            className="config-textarea"
            value={config.info_adicional || ''}
            onChange={(e) => handleChange('info_adicional', e.target.value)}
            placeholder="Información sobre pagos, envíos, horarios..."
          />
          <p className="config-hint">
            Este texto se mostrará organizado en tarjetas con iconos automáticos.
            <br /><strong>💡 Tip:</strong> Separa secciones con una línea en blanco doble para mejor organización.
            <br /><strong>Ejemplo:</strong>
            <br />Transferencia bancaria
            <br />Efectivo al retirar
            <br />
            <br />Retiro en tienda (consultar dirección)
            <br />Envío a Santiago
          </p>
        </div>
      </div>

      {/* Botones de acción */}
      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        marginTop: '32px'
      }}>
        <button
          onClick={loadConfig}
          disabled={saving}
          style={{
            padding: '14px 24px',
            background: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s',
            minHeight: '50px',
            opacity: saving ? 0.5 : 1
          }}
          onMouseOver={(e) => {
            if (!saving) e.currentTarget.style.background = '#d1d5db';
          }}
          onMouseOut={(e) => {
            if (!saving) e.currentTarget.style.background = '#e5e7eb';
          }}
        >
          🔄 Recargar
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '14px 32px',
            background: saving ? '#9ca3af' : 'linear-gradient(135deg, #7a9999, #5b7a7a)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s',
            boxShadow: saving ? 'none' : '0 8px 16px rgba(91,122,122,0.3)',
            minHeight: '50px'
          }}
          onMouseOver={(e) => {
            if (!saving) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 20px rgba(91,122,122,0.4)';
            }
          }}
          onMouseOut={(e) => {
            if (!saving) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(91,122,122,0.3)';
            }
          }}
        >
          {saving ? '💾 Guardando...' : '💾 Guardar Cambios'}
        </button>
      </div>
    </div>
  );
}