import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        onLoginSuccess(data.user);
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setError("❌ Email o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f0e8 0%, #dce3e0 50%, #c5d3d1 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .login-container {
          animation: fadeIn 0.5s ease-out;
        }

        @media (max-width: 480px) {
          .login-title {
            font-size: 28px !important;
          }
          .login-subtitle {
            font-size: 14px !important;
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

      <div className="login-container" style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '20px',
        padding: '48px',
        maxWidth: '450px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        border: '3px solid #a8b8b5',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="https://cienciaterapia.org/wp-content/uploads/reloj-arena.png"
            alt="Bazar Retro"
            style={{ 
              height: '80px', 
              marginBottom: '20px',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
            }}
          />
          
          <div style={{
            width: '120px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #5b7a7a, transparent)',
            margin: '0 auto 20px'
          }}></div>

          <h1 className="login-title" style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: '#1e3a3a',
            marginBottom: '8px',
            fontFamily: 'Georgia, serif',
            textShadow: '2px 2px 0px rgba(255,255,255,0.5)'
          }}>
            Panel Admin
          </h1>
          <p className="login-subtitle" style={{
            color: '#4a6565',
            fontSize: '15px',
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif'
          }}>
            🔐 Acceso seguro al sistema
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin}>
          {/* Email */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c4a4a',
              marginBottom: '8px'
            }}>
              📧 Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@bazarretro.cl"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #a8b8b5',
                borderRadius: '10px',
                fontSize: '16px',
                background: 'white',
                color: '#1e3a3a',
                boxSizing: 'border-box',
                transition: 'all 0.3s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#7a9999';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(122,153,153,0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#a8b8b5';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2c4a4a',
              marginBottom: '8px'
            }}>
              🔑 Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #a8b8b5',
                borderRadius: '10px',
                fontSize: '16px',
                background: 'white',
                color: '#1e3a3a',
                boxSizing: 'border-box',
                transition: 'all 0.3s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#7a9999';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(122,153,153,0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#a8b8b5';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fee2e2',
              border: '2px solid #ef4444',
              color: '#991b1b',
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '14px',
              fontWeight: '600',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #7a9999, #5b7a7a)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: loading ? 'none' : '0 8px 16px rgba(91,122,122,0.3)',
              fontFamily: 'Georgia, serif',
              minHeight: '56px'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 20px rgba(91,122,122,0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(91,122,122,0.3)';
              }
            }}
          >
            {loading ? '🔄 Iniciando sesión...' : '🔓 Iniciar Sesión'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '2px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '13px',
            color: '#6b7a7a',
            fontStyle: 'italic'
          }}>
            🔒 Conexión segura con Supabase Auth
          </p>
        </div>
      </div>
    </div>
  );
}