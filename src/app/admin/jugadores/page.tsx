'use client';

import { useState, useMemo } from 'react';
import { Users, Plus, Pencil, Trash2, Save, X, Search, Upload } from 'lucide-react';
import { useLeagueData } from '@/lib/DataContext';
import type { Player } from '@/lib/types';
import TeamLogo from '@/components/TeamLogo';

const POSITIONS = ['Base', 'Escolta', 'Alero', 'Ala-Pívot', 'Pívot'] as const;

interface EditingPlayer {
  id: string;
  teamId: string;
  name: string;
  number: string;
  position: string[];
  birthDate: string;
  photoUrl: string;
  isActive: boolean;
  isNew?: boolean;
}

export default function JugadoresPage() {
  const { players: contextPlayers, teams, updatePlayers } = useLeagueData();
  const [playerList, setPlayerList] = useState<Player[]>(contextPlayers);
  const [editingPlayer, setEditingPlayer] = useState<EditingPlayer | null>(null);
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Sync with context when it updates
  useState(() => {
    setPlayerList(contextPlayers);
  });

  // Use context players as source of truth
  const currentPlayers = contextPlayers;

  const filteredPlayers = useMemo(() => {
    return currentPlayers
      .filter(p => {
        if (filterTeam !== 'all' && p.teamId !== filterTeam) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return p.name.toLowerCase().includes(q) || p.number.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (a.teamId !== b.teamId) return a.teamId.localeCompare(b.teamId);
        return parseInt(a.number) - parseInt(b.number);
      });
  }, [currentPlayers, filterTeam, searchQuery]);

  function handleStartEdit(player: Player) {
    setEditingPlayer({
      ...player,
      birthDate: player.birthDate || '',
      photoUrl: player.photoUrl || '',
      position: Array.isArray(player.position) ? player.position : [player.position],
    });
  }

  function handleStartAdd() {
    const teamId = filterTeam !== 'all' ? filterTeam : teams[0].id;
    setEditingPlayer({
      id: `p-new-${Date.now()}`,
      teamId,
      name: '',
      number: '',
      position: [],
      birthDate: '',
      photoUrl: '',
      isActive: true,
      isNew: true,
    });
  }

  function handleSavePlayer() {
    if (!editingPlayer) return;
    if (!editingPlayer.name.trim() || !editingPlayer.number.trim()) return;

    let updated: Player[];
    if (editingPlayer.isNew) {
      updated = [...currentPlayers, {
        id: editingPlayer.id,
        teamId: editingPlayer.teamId,
        name: editingPlayer.name.trim(),
        number: editingPlayer.number.trim(),
        position: editingPlayer.position,
        birthDate: editingPlayer.birthDate || undefined,
        photoUrl: editingPlayer.photoUrl || undefined,
        isActive: editingPlayer.isActive,
      }];
    } else {
      updated = currentPlayers.map(p => p.id === editingPlayer.id ? {
        ...p,
        name: editingPlayer.name.trim(),
        number: editingPlayer.number.trim(),
        teamId: editingPlayer.teamId,
        position: editingPlayer.position,
        birthDate: editingPlayer.birthDate || undefined,
        photoUrl: editingPlayer.photoUrl || undefined,
        isActive: editingPlayer.isActive,
      } : p);
    }

    updatePlayers(updated);
    setEditingPlayer(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleDeletePlayer(playerId: string) {
    const updated = currentPlayers.filter(p => p.id !== playerId);
    updatePlayers(updated);
    setDeleteConfirm(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function togglePosition(pos: string) {
    if (!editingPlayer) return;
    const current = editingPlayer.position;
    const newPositions = current.includes(pos)
      ? current.filter(p => p !== pos)
      : [...current, pos];
    setEditingPlayer({ ...editingPlayer, position: newPositions });
  }

  function handlePhotoUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setEditingPlayer(prev => prev ? { ...prev, photoUrl: dataUrl } : null);
    };
    reader.readAsDataURL(file);
  }

  // Group players by team for display
  const groupedByTeam = useMemo(() => {
    const groups: Record<string, Player[]> = {};
    filteredPlayers.forEach(p => {
      if (!groups[p.teamId]) groups[p.teamId] = [];
      groups[p.teamId].push(p);
    });
    return groups;
  }, [filteredPlayers]);

  return (
    <>
      {/* Save indicator */}
      {saved && (
        <div style={{
          position: 'fixed',
          top: 80,
          right: 24,
          padding: 'var(--space-3) var(--space-5)',
          background: 'var(--color-success)',
          color: '#fff',
          borderRadius: 'var(--radius-full)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          zIndex: 100,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <Save size={14} />
          Guardado
        </div>
      )}

      {/* Controls bar */}
      <div className="section animate-fade-in-up" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-light)',
            flex: 1,
            minWidth: 200,
            maxWidth: 300,
          }}>
            <Search size={16} style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              type="text"
              placeholder="Buscar jugador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                outline: 'none',
                width: '100%',
              }}
            />
          </div>

          {/* Team filter */}
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            <option value="all">Todos los equipos</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div style={{ flex: 1 }} />

          {/* Add player */}
          <button
            onClick={handleStartAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-5)',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            <Plus size={16} />
            Añadir jugador
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editingPlayer && (
        <div className="section animate-fade-in-up" style={{
          marginBottom: 'var(--space-4)',
          border: '2px solid var(--color-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          background: 'var(--color-bg-card)',
          boxShadow: '0 0 0 4px rgba(0, 122, 255, 0.1)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-5)',
          }}>
            <h3 style={{ fontWeight: 700 }}>
              {editingPlayer.isNew ? '➕ Nuevo jugador' : `✏️ Editando: ${editingPlayer.name}`}
            </h3>
            <button
              onClick={() => setEditingPlayer(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-tertiary)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Name */}
            <div>
              <label style={labelStyle}>Nombre completo</label>
              <input
                type="text"
                value={editingPlayer.name}
                onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                placeholder="Nombre del jugador"
                style={inputStyle}
              />
            </div>

            {/* Number */}
            <div>
              <label style={labelStyle}>Dorsal</label>
              <input
                type="text"
                value={editingPlayer.number}
                onChange={(e) => setEditingPlayer({ ...editingPlayer, number: e.target.value })}
                placeholder="00"
                maxLength={3}
                style={{ ...inputStyle, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.1em' }}
              />
            </div>

            {/* Team */}
            <div>
              <label style={labelStyle}>Equipo</label>
              <select
                value={editingPlayer.teamId}
                onChange={(e) => setEditingPlayer({ ...editingPlayer, teamId: e.target.value })}
                style={inputStyle}
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Birth date */}
            <div>
              <label style={labelStyle}>Fecha de nacimiento</label>
              <input
                type="date"
                value={editingPlayer.birthDate}
                onChange={(e) => setEditingPlayer({ ...editingPlayer, birthDate: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Positions */}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <label style={labelStyle}>Posición(es)</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {POSITIONS.map(pos => {
                const isSelected = editingPlayer.position.includes(pos);
                return (
                  <button
                    key={pos}
                    onClick={() => togglePosition(pos)}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-full)',
                      border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: isSelected ? 'rgba(0, 122, 255, 0.1)' : 'var(--color-bg-secondary)',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: 'var(--text-sm)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo upload */}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <label style={labelStyle}>Foto del jugador</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {editingPlayer.photoUrl && (
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                }}>
                  <img src={editingPlayer.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <input
                id="player-photo-upload"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => document.getElementById('player-photo-upload')?.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--color-border-hover)',
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-primary)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <Upload size={14} />
                {editingPlayer.photoUrl ? 'Cambiar foto' : 'Subir foto'}
              </button>
            </div>
          </div>

          {/* Save / Cancel */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-5)' }}>
            <button onClick={() => setEditingPlayer(null)} style={{
              padding: 'var(--space-2) var(--space-5)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}>
              Cancelar
            </button>
            <button
              onClick={handleSavePlayer}
              disabled={!editingPlayer.name.trim() || !editingPlayer.number.trim()}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: (!editingPlayer.name.trim() || !editingPlayer.number.trim()) ? 'var(--color-border)' : 'var(--color-primary)',
                color: '#fff',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: (!editingPlayer.name.trim() || !editingPlayer.number.trim()) ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Save size={14} />
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Player list */}
      {Object.entries(groupedByTeam).map(([teamId, teamPlayers]) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return null;
        return (
          <div key={teamId} className="section animate-fade-in-up" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
            }}>
              <TeamLogo team={team} size="sm" />
              <h3 style={{ fontWeight: 700 }}>{team.name}</h3>
              <span style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
                background: 'var(--color-bg-secondary)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}>
                {teamPlayers.length} jugadores
              </span>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Nombre</th>
                    <th>Posición</th>
                    <th>Nacimiento</th>
                    <th style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {teamPlayers.map(player => (
                    <tr key={player.id}>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: team.primaryColor }}>
                        {player.number}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          {player.photoUrl && (
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: 'var(--radius-full)',
                              overflow: 'hidden',
                              border: '1px solid var(--color-border-light)',
                            }}>
                              <img src={player.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <span style={{ fontWeight: 600 }}>{player.name}</span>
                          {!player.isActive && (
                            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>(inactivo)</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                          {(Array.isArray(player.position) ? player.position : [player.position]).map(pos => (
                            <span key={pos} className="badge badge-primary" style={{ fontSize: '10px' }}>
                              {pos}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                        {player.birthDate || '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <button
                            onClick={() => handleStartEdit(player)}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border-light)',
                              background: 'var(--color-bg-secondary)',
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          {deleteConfirm === player.id ? (
                            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                              <button
                                onClick={() => handleDeletePlayer(player.id)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: 'none',
                                  background: 'var(--color-danger)',
                                  color: '#fff',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontFamily: 'var(--font-body)',
                                }}
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-bg-card)',
                                  color: 'var(--color-text-secondary)',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                  fontFamily: 'var(--font-body)',
                                }}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(player.id)}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border-light)',
                                background: 'var(--color-bg-secondary)',
                                color: 'var(--color-danger)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}

// Shared styles
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 'var(--space-2)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-secondary)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-body)',
  outline: 'none',
};
