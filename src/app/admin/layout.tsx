'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Settings, Users, FileSpreadsheet, CalendarDays, Lock, Eye, EyeOff, LogOut, KeyRound } from 'lucide-react';

const adminTabs = [
  { id: 'equipos', label: 'Equipos', href: '/admin', icon: Settings },
  { id: 'jugadores', label: 'Jugadores', href: '/admin/jugadores', icon: Users },
  { id: 'calendario', label: 'Calendario', href: '/admin/calendario', icon: CalendarDays },
  { id: 'importar', label: 'Importar Actas', href: '/admin/importar', icon: FileSpreadsheet },
];

const AUTH_KEY = 'parish-admin-auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [changePwMsg, setChangePwMsg] = useState('');
  const [changePwError, setChangePwError] = useState('');

  // Check existing session
  useEffect(() => {
    const auth = sessionStorage.getItem(AUTH_KEY);
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        setIsAuthenticated(true);
      } else {
        setError(data.error || 'Contraseña incorrecta');
        setPassword('');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setPassword('');
    setError('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwMsg('');
    setChangePwError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentPw, action: 'change', newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChangePwMsg('✅ Contraseña actualizada');
        setCurrentPw('');
        setNewPw('');
        setTimeout(() => { setShowChangePassword(false); setChangePwMsg(''); }, 2000);
      } else {
        setChangePwError(data.error || 'Error al cambiar contraseña');
      }
    } catch {
      setChangePwError('Error de conexión');
    }
  };

  function getActiveTab() {
    if (pathname === '/admin/jugadores') return 'jugadores';
    if (pathname === '/admin/calendario') return 'calendario';
    if (pathname === '/admin/importar') return 'importar';
    return 'equipos';
  }

  const activeTab = getActiveTab();

  // Loading state
  if (isChecking) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--color-text-tertiary)' }}>Verificando acceso...</div>
      </div>
    );
  }

  // Login gate
  if (!isAuthenticated) {
    return (
      <div className="page-container" style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '70vh',
      }}>
        <div style={{
          width: 380, maxWidth: 'calc(100vw - 32px)',
          background: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border-light)',
          overflow: 'hidden',
          animation: 'fadeInUp 0.4s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '28px 28px 20px',
            background: 'linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-card))',
            textAlign: 'center',
            borderBottom: '1px solid var(--color-border-light)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, #1a73e8, #6c5ce7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 4px 16px rgba(26, 115, 232, 0.3)',
            }}>
              <Lock size={24} color="#fff" />
            </div>
            <h2 style={{
              fontSize: 'var(--text-lg)', fontWeight: 700,
              color: 'var(--color-text-primary)', marginBottom: 4,
            }}>
              Panel de Administración
            </h2>
            <p style={{
              fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)',
            }}>
              Introduce la clave de acceso
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ padding: '24px 28px 28px' }}>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Contraseña"
                autoFocus
                disabled={isLoading}
                style={{
                  width: '100%', padding: '12px 44px 12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border-light)'}`,
                  background: 'var(--color-bg-secondary)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { if (!error) e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                onBlur={e => { if (!error) e.currentTarget.style.borderColor = 'var(--color-border-light)'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-tertiary)', padding: 4,
                  display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div style={{
                fontSize: 'var(--text-xs)', color: 'var(--color-danger)',
                marginBottom: 14, textAlign: 'center',
                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 59, 48, 0.08)',
              }}>
                🔒 {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!password.trim() || isLoading}
              style={{
                width: '100%', padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: password.trim() && !isLoading
                  ? 'linear-gradient(135deg, #1a73e8, #6c5ce7)'
                  : 'var(--color-bg-secondary)',
                color: password.trim() && !isLoading ? '#fff' : 'var(--color-text-tertiary)',
                fontSize: 'var(--text-sm)', fontWeight: 600,
                fontFamily: 'var(--font-body)',
                cursor: password.trim() && !isLoading ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
            >
              {isLoading ? 'Verificando...' : 'Acceder'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated — show admin panel
  return (
    <div className="page-container">
      {/* Admin Header */}
      <div className="section animate-fade-in-up">
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-4)',
        }}>
          <h1 style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            margin: 0,
          }}>
            <Settings size={28} style={{ color: 'var(--color-primary)' }} />
            Panel de Administración
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setShowChangePassword(!showChangePassword); setChangePwMsg(''); setChangePwError(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--text-xs)', fontWeight: 500,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.borderColor = 'var(--color-border-light)'; }}
            >
              <KeyRound size={14} />
              Cambiar clave
            </button>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--text-xs)', fontWeight: 500,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.borderColor = 'var(--color-danger)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.borderColor = 'var(--color-border-light)'; }}
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Change Password Form */}
        {showChangePassword && (
          <form onSubmit={handleChangePassword} style={{
            display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
            padding: '14px 18px', marginBottom: 'var(--space-4)',
            background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-light)',
          }}>
            <input
              type="password" value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              placeholder="Clave actual"
              style={{
                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-card)',
                fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)', outline: 'none', width: 140,
              }}
            />
            <input
              type="password" value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Nueva clave (mín 4)"
              style={{
                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-card)',
                fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)', outline: 'none', width: 160,
              }}
            />
            <button type="submit" disabled={!currentPw || !newPw} style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)',
              border: 'none', fontSize: 'var(--text-xs)', fontWeight: 600,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
              background: currentPw && newPw ? 'var(--color-primary)' : 'var(--color-bg-card)',
              color: currentPw && newPw ? '#fff' : 'var(--color-text-tertiary)',
              transition: 'all 0.2s',
            }}>
              Guardar
            </button>
            {changePwMsg && <span style={{ fontSize: 'var(--text-xs)', color: '#34c759' }}>{changePwMsg}</span>}
            {changePwError && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>❌ {changePwError}</span>}
          </form>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-1)',
          padding: 'var(--space-1)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-6)',
          width: 'fit-content',
        }}>
          {adminTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-5)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isActive ? 'var(--color-bg-card)' : 'transparent',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  textDecoration: 'none',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
