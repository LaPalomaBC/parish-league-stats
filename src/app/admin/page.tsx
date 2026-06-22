'use client';

import { useState, useRef } from 'react';
import { Settings, Save, Upload, X, Check, Palette, Type, Hash, Image } from 'lucide-react';
import { teams as defaultTeams } from '@/lib/data';
import { useLeagueData } from '@/lib/DataContext';
import type { Team } from '@/lib/types';
import TeamLogo from '@/components/TeamLogo';

export default function AdminPage() {
  const { teams: contextTeams, updateTeams } = useLeagueData();
  const [editingTeams, setEditingTeams] = useState<Team[]>(contextTeams);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editingTeam = editingId ? editingTeams.find(t => t.id === editingId) : null;

  function handleFieldChange(teamId: string, field: keyof Team, value: string) {
    setEditingTeams(prev =>
      prev.map(t => t.id === teamId ? { ...t, [field]: value } : t)
    );
  }

  function handleLogoUpload(teamId: string, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLogoPreview(prev => ({ ...prev, [teamId]: dataUrl }));
      handleFieldChange(teamId, 'logoUrl', dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    updateTeams(editingTeams);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    setEditingTeams(defaultTeams);
    setLogoPreview({});
    updateTeams(defaultTeams);
  }

  // Predefined color palette for quick selection
  const colorPalette = [
    { label: 'Negro', value: '#1D1D1F' },
    { label: 'Blanco', value: '#8E8E93' },
    { label: 'Rojo', value: '#FF3B30' },
    { label: 'Naranja', value: '#FF9500' },
    { label: 'Amarillo', value: '#E8A317' },
    { label: 'Verde', value: '#34C759' },
    { label: 'Azul celeste', value: '#5AC8FA' },
    { label: 'Azul', value: '#007AFF' },
    { label: 'Azul marino', value: '#1B3A5C' },
    { label: 'Morado', value: '#AF52DE' },
    { label: 'Rosa', value: '#FF2D55' },
    { label: 'Gris', value: '#636366' },
  ];

  return (
    <>
      <div className="section animate-fade-in-up">
        {/* Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
        }}>
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-sm)',
            maxWidth: 500,
            lineHeight: 1.6,
          }}>
            Gestiona los datos de los equipos de la liga. Haz clic en un equipo para editar sus datos.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              onClick={handleReset}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'all var(--transition-fast)',
              }}
            >
              Restaurar
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: saved ? 'var(--color-success)' : 'var(--color-primary)',
                color: '#fff',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                transition: 'all var(--transition-fast)',
              }}
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'Guardado' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Team Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {editingTeams.map((team, index) => {
            const isEditing = editingId === team.id;
            const preview = logoPreview[team.id] || team.logoUrl;

            return (
              <div
                key={team.id}
                className="animate-fade-in-up"
                style={{
                  animationDelay: `${index * 0.03}s`,
                  opacity: 0,
                }}
              >
                {/* Team Row */}
                <div
                  onClick={() => setEditingId(isEditing ? null : team.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4) var(--space-5)',
                    background: isEditing ? 'var(--color-bg-card)' : 'var(--color-bg-card)',
                    border: `1px solid ${isEditing ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                    borderRadius: isEditing ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    boxShadow: isEditing ? '0 0 0 3px rgba(0, 122, 255, 0.1)' : 'var(--shadow-xs)',
                  }}
                  id={`team-row-${team.id}`}
                >
                  {/* Logo */}
                  {preview ? (
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1px solid var(--color-border)',
                    }}>
                      <img
                        src={preview}
                        alt={team.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <TeamLogo team={team} size="md" />
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600,
                      fontSize: 'var(--text-base)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {team.name}
                    </div>
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-tertiary)',
                    }}>
                      {team.shortName}
                    </div>
                  </div>

                  {/* Color indicator */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: 'var(--radius-full)',
                      background: team.primaryColor,
                      border: '2px solid var(--color-border)',
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-tertiary)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {team.primaryColor}
                    </span>
                  </div>

                  {/* Chevron */}
                  <div style={{
                    transform: isEditing ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform var(--transition-fast)',
                    color: 'var(--color-text-tertiary)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    ▼
                  </div>
                </div>

                {/* Edit Panel */}
                {isEditing && (
                  <div style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-primary)',
                    borderTop: 'none',
                    borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                    padding: 'var(--space-6)',
                    boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)',
                  }}>
                    <div className="grid-2" style={{ gap: 'var(--space-5)' }}>
                      {/* Name */}
                      <div>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          color: 'var(--color-text-secondary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 'var(--space-2)',
                        }}>
                          <Type size={14} />
                          Nombre del equipo
                        </label>
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => handleFieldChange(team.id, 'name', e.target.value)}
                          style={{
                            width: '100%',
                            padding: 'var(--space-3) var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-primary)',
                            fontSize: 'var(--text-base)',
                            fontFamily: 'var(--font-body)',
                            outline: 'none',
                            transition: 'border-color var(--transition-fast)',
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                          onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                        />
                      </div>

                      {/* Short Name */}
                      <div>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          color: 'var(--color-text-secondary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 'var(--space-2)',
                        }}>
                          <Hash size={14} />
                          Clave (3 letras)
                        </label>
                        <input
                          type="text"
                          value={team.shortName}
                          maxLength={3}
                          onChange={(e) => handleFieldChange(team.id, 'shortName', e.target.value.toUpperCase())}
                          style={{
                            width: '100%',
                            padding: 'var(--space-3) var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-primary)',
                            fontSize: 'var(--text-base)',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            letterSpacing: '0.1em',
                            outline: 'none',
                            transition: 'border-color var(--transition-fast)',
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                          onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                        />
                      </div>
                    </div>

                    {/* Color */}
                    <div style={{ marginTop: 'var(--space-5)' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 'var(--space-3)',
                      }}>
                        <Palette size={14} />
                        Color del equipo
                      </label>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-4)',
                        flexWrap: 'wrap',
                      }}>
                        {/* Color swatches */}
                        <div style={{
                          display: 'flex',
                          gap: 'var(--space-2)',
                          flexWrap: 'wrap',
                        }}>
                          {colorPalette.map(color => (
                            <button
                              key={color.value}
                              title={color.label}
                              onClick={() => {
                                handleFieldChange(team.id, 'primaryColor', color.value);
                                handleFieldChange(team.id, 'secondaryColor', color.value);
                              }}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 'var(--radius-full)',
                                background: color.value,
                                border: team.primaryColor === color.value
                                  ? '3px solid var(--color-primary)'
                                  : '2px solid var(--color-border)',
                                cursor: 'pointer',
                                transition: 'all var(--transition-fast)',
                                boxShadow: team.primaryColor === color.value
                                  ? '0 0 0 2px rgba(0, 122, 255, 0.3)'
                                  : 'none',
                              }}
                            />
                          ))}
                        </div>

                        {/* Custom color input */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-1) var(--space-3)',
                          background: 'var(--color-bg-secondary)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                        }}>
                          <input
                            type="color"
                            value={team.primaryColor}
                            onChange={(e) => {
                              handleFieldChange(team.id, 'primaryColor', e.target.value);
                              handleFieldChange(team.id, 'secondaryColor', e.target.value);
                            }}
                            style={{
                              width: 24,
                              height: 24,
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          />
                          <span style={{
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--color-text-secondary)',
                          }}>
                            {team.primaryColor}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Logo upload */}
                    <div style={{ marginTop: 'var(--space-5)' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 'var(--space-3)',
                      }}>
                        <Image size={14} />
                        Logo del equipo
                      </label>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-4)',
                      }}>
                        {/* Preview */}
                        {preview ? (
                          <div style={{
                            position: 'relative',
                            width: 64,
                            height: 64,
                            borderRadius: 'var(--radius-lg)',
                            overflow: 'hidden',
                            border: '1px solid var(--color-border)',
                            flexShrink: 0,
                          }}>
                            <img
                              src={preview}
                              alt={team.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLogoPreview(prev => {
                                  const next = { ...prev };
                                  delete next[team.id];
                                  return next;
                                });
                                handleFieldChange(team.id, 'logoUrl', '');
                              }}
                              style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                width: 20,
                                height: 20,
                                borderRadius: 'var(--radius-full)',
                                background: 'rgba(0,0,0,0.6)',
                                border: 'none',
                                color: '#fff',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <TeamLogo team={team} size="lg" />
                        )}

                        {/* Upload button */}
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleLogoUpload(team.id, file);
                              e.target.value = '';
                            }}
                            style={{ display: 'none' }}
                            id={`logo-upload-${team.id}`}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const input = document.getElementById(`logo-upload-${team.id}`) as HTMLInputElement;
                              input?.click();
                            }}
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
                              fontWeight: 500,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-body)',
                              transition: 'all var(--transition-fast)',
                            }}
                          >
                            <Upload size={14} />
                            Subir logo
                          </button>
                          <p style={{
                            fontSize: '11px',
                            color: 'var(--color-text-tertiary)',
                            marginTop: 'var(--space-1)',
                          }}>
                            PNG, JPG o SVG. Max 500KB.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Live preview */}
                    <div style={{
                      marginTop: 'var(--space-5)',
                      padding: 'var(--space-4)',
                      background: 'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                    }}>
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-tertiary)',
                        fontWeight: 500,
                      }}>
                        Vista previa:
                      </span>
                      {preview ? (
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          border: '1px solid var(--color-border)',
                        }}>
                          <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <TeamLogo team={team} size="sm" />
                      )}
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {team.name}
                      </span>
                      <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                        {team.shortName}
                      </span>
                      <div style={{
                        width: 3,
                        height: 16,
                        borderRadius: 'var(--radius-full)',
                        background: `linear-gradient(180deg, ${team.primaryColor}, ${team.secondaryColor})`,
                      }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="card-flat animate-fade-in-up" style={{
        display: 'flex',
        gap: 'var(--space-3)',
        alignItems: 'flex-start',
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-secondary)',
        lineHeight: 1.6,
      }}>
        <Settings size={18} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Nota:</strong> Los cambios se guardan localmente en tu navegador.
          Cuando conectemos la base de datos (Supabase), los cambios se sincronizarán
          en la nube y serán visibles para todos los usuarios.
        </div>
      </div>
    </>
  );
}
