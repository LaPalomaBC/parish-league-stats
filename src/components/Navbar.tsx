'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Trophy,
  Users,
  Calendar,
  BarChart3,
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

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop top navbar */}
      <nav className="navbar" id="main-navbar">
        <div className="navbar-inner">
          <Link href="/" className="navbar-brand">
            <Image src="/logo-pl.png" alt="Parish League" width={44} height={44} style={{ borderRadius: 'var(--radius-md)' }} priority />
            <span>Parish League</span>
          </Link>

          <ul className="navbar-links">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={isActive(href) ? 'active' : ''}
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
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-tab-bar" id="mobile-tab-bar">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`mobile-tab-item ${isActive(href) ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
