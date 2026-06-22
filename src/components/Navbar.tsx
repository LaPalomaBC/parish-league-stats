'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Trophy,
  Users,
  Calendar,
  BarChart3,
  Menu,
  X,
  Settings,
} from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/clasificacion', label: 'Clasificación', icon: Trophy },
  { href: '/equipos', label: 'Equipos', icon: Users },
  { href: '/calendario', label: 'Calendario', icon: Calendar },
  { href: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <Image src="/logo-pl.png" alt="Parish League" width={44} height={44} style={{ borderRadius: 'var(--radius-md)' }} priority />
          <span>Parish League</span>
        </Link>

        <ul className={`navbar-links ${mobileOpen ? 'open' : ''}`}>
          {navLinks.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className={pathname === href ? 'active' : ''}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={16} />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/admin"
          className={pathname.startsWith('/admin') ? 'active' : ''}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-full)',
            color: pathname.startsWith('/admin') ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
            background: pathname.startsWith('/admin') ? 'var(--color-primary-bg)' : 'transparent',
            transition: 'all var(--transition-fast)',
            marginLeft: 'var(--space-2)',
          }}
          title="Configuración"
        >
          <Settings size={18} />
        </Link>

        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </nav>
  );
}
