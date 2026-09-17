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
  ChevronDown,
  Archive,
  Radio,
} from 'lucide-react';
import { useLeagueData } from '@/lib/DataContext';
import { useState, useRef, useEffect } from 'react';

const navLinks = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/clasificacion', label: 'Clasificación', icon: Trophy },
  { href: '/equipos', label: 'Equipos', icon: Users },
  { href: '/calendario', label: 'Calendario', icon: Calendar },
  { href: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
];

export default function Navbar() {
  const pathname = usePathname();
  const { seasons, currentSeason, isArchive, setCurrentSeasonId } = useLeagueData();
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Close picker on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowSeasonPicker(false);
      }
    }
    if (showSeasonPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSeasonPicker]);

  const hasMultipleSeasons = seasons.length > 1;

  return (
    <>
      {/* Archive Banner */}
      {isArchive && currentSeason && (
        <div className="archive-banner" id="archive-banner">
          <Archive size={14} />
          <span>Viendo archivo: <strong>{currentSeason.label}</strong></span>
          <button
            className="archive-banner-btn"
            onClick={() => {
              const active = seasons.find(s => s.isActive);
              if (active) setCurrentSeasonId(active.id);
            }}
          >
            Ir a temporada actual →
          </button>
        </div>
      )}

      {/* Desktop top navbar */}
      <nav className="navbar" id="main-navbar" style={isArchive ? { top: 36 } : undefined}>
        <div className="navbar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Link href="/" className="navbar-brand">
              <Image src="/logo-pl.png" alt="Parish League" width={44} height={44} style={{ borderRadius: 'var(--radius-md)' }} priority />
              <span>Parish League</span>
            </Link>

            {/* Season Selector */}
            {hasMultipleSeasons && currentSeason && (
              <div className="season-selector" ref={pickerRef}>
                <button
                  className="season-selector-btn"
                  onClick={() => setShowSeasonPicker(!showSeasonPicker)}
                  aria-label="Cambiar temporada"
                >
                  {currentSeason.isActive ? (
                    <span className="season-badge-live"><Radio size={10} /> LIVE</span>
                  ) : (
                    <span className="season-badge-archive"><Archive size={10} /></span>
                  )}
                  <span className="season-selector-label">{currentSeason.id.replace('-', '/')}</span>
                  <ChevronDown size={14} className={`season-chevron ${showSeasonPicker ? 'open' : ''}`} />
                </button>

                {showSeasonPicker && (
                  <div className="season-dropdown">
                    {seasons.map(s => (
                      <button
                        key={s.id}
                        className={`season-dropdown-item ${s.id === currentSeason.id ? 'selected' : ''}`}
                        onClick={() => {
                          setCurrentSeasonId(s.id);
                          setShowSeasonPicker(false);
                        }}
                      >
                        <span className="season-dropdown-label">
                          {s.isActive ? <Radio size={12} className="season-live-icon" /> : <Archive size={12} />}
                          {s.label}
                        </span>
                        {s.isActive && <span className="season-badge-live-sm">LIVE</span>}
                        {s.archivedAt && <span className="season-archived-date">{s.archivedAt}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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
