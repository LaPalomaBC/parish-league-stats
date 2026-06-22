'use client';

import { useState, useCallback, useMemo } from 'react';
import { FileSpreadsheet, Upload, Check, AlertCircle, ChevronRight, Users, Trophy, Trash2, Calendar, Zap, UserPlus, BarChart3, Clock, SkipForward, Layers } from 'lucide-react';
import { parseActaExcel } from '@/lib/parseActa';
import { useLeagueData } from '@/lib/DataContext';
import { matchTeamByName, matchOrCreatePlayer, checkDuplicate, executeImport, detectForfeit } from '@/lib/importEngine';
import type { ParsedActa, ParsedPlayerLine, Team } from '@/lib/types';
import type { ImportResult, ForfeitInfo } from '@/lib/importEngine';
import TeamLogo from '@/components/TeamLogo';

type ImportStep = 'upload' | 'preview' | 'done';

interface QueuedActa {
  fileName: string;
  parsedActa: ParsedActa;
  status: 'pending' | 'imported' | 'skipped' | 'error';
  error?: string;
}

export default function ImportarPage() {
  const {
    teams, players, matches, playerStats, standings, importHistory,
    updatePlayers, updateMatches, updatePlayerStats, updateStandings, addImportRecord,
    removeImportRecord,
  } = useLeagueData();

  const [step, setStep] = useState<ImportStep>('upload');
  const [parsedActa, setParsedActa] = useState<ParsedActa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  // Queue for multi-file import
  const [queue, setQueue] = useState<QueuedActa[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [importedCount, setImportedCount] = useState(0);

  // Import options
  const [selectedMatchType, setSelectedMatchType] = useState<'regular' | 'copa' | 'playoff'>('regular');
  const [manualMatchday, setManualMatchday] = useState(1);

  // Forfeit (incomparecencia) — manual selector
  const [manualForfeit, setManualForfeit] = useState<'none' | 'home' | 'away'>('none');

  // Import result
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Matched teams (computed from parsed acta)
  const matchedHome = useMemo(() =>
    parsedActa ? matchTeamByName(parsedActa.homeTeamName, teams) : undefined,
    [parsedActa, teams]
  );
  const matchedAway = useMemo(() =>
    parsedActa ? matchTeamByName(parsedActa.awayTeamName, teams) : undefined,
    [parsedActa, teams]
  );

  // Player matching preview
  const homePlayerPreview = useMemo(() => {
    if (!parsedActa || !matchedHome) return [];
    return parsedActa.homePlayers.map(line => {
      const result = matchOrCreatePlayer(line, matchedHome.id, players);
      return { line, ...result };
    });
  }, [parsedActa, matchedHome, players]);

  const awayPlayerPreview = useMemo(() => {
    if (!parsedActa || !matchedAway) return [];
    return parsedActa.awayPlayers.map(line => {
      const result = matchOrCreatePlayer(line, matchedAway.id, players);
      return { line, ...result };
    });
  }, [parsedActa, matchedAway, players]);

  // Auto-detect matchday for Liga Regular
  // Finds the first unplayed match between the two detected teams
  const autoDetectedMatch = useMemo(() => {
    if (!matchedHome || !matchedAway || selectedMatchType !== 'regular') return undefined;
    return matches.find(m =>
      !m.isPlayed &&
      ((m.homeTeamId === matchedHome.id && m.awayTeamId === matchedAway.id) ||
       (m.homeTeamId === matchedAway.id && m.awayTeamId === matchedHome.id))
    );
  }, [matchedHome, matchedAway, matches, selectedMatchType]);

  // The effective matchday to use for import
  const effectiveMatchday = selectedMatchType === 'regular'
    ? (autoDetectedMatch?.matchday ?? 0)
    : manualMatchday;

  // Duplicate check: it's a duplicate only if there are NO unplayed matches
  // between these teams in the calendar (all slots already filled)
  const duplicateMatch = useMemo(() => {
    if (!matchedHome || !matchedAway) return undefined;
    if (selectedMatchType !== 'regular') return undefined; // Copa/Playoff always allow

    // Check if ALL matches between these teams are already played
    const allMatchesBetween = matches.filter(m =>
      (m.homeTeamId === matchedHome.id && m.awayTeamId === matchedAway.id) ||
      (m.homeTeamId === matchedAway.id && m.awayTeamId === matchedHome.id)
    );
    const anyUnplayed = allMatchesBetween.some(m => !m.isPlayed);
    if (anyUnplayed) return undefined; // There's a free slot → not a duplicate

    // All slots filled → return the last played match as the duplicate reference
    const lastPlayed = allMatchesBetween.filter(m => m.isPlayed).pop();
    return lastPlayed;
  }, [matchedHome, matchedAway, matches, selectedMatchType]);

  // Process multiple files into a queue
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files).filter(
      f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );

    if (fileArray.length === 0) {
      setError('Solo se admiten archivos Excel (.xlsx)');
      return;
    }

    const newQueue: QueuedActa[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      try {
        const buffer = await file.arrayBuffer();
        const acta = parseActaExcel(buffer);
        newQueue.push({ fileName: file.name, parsedActa: acta, status: 'pending' });
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    if (errors.length > 0 && newQueue.length === 0) {
      setError(`Error al parsear: ${errors.join('; ')}`);
      return;
    }

    if (newQueue.length > 0) {
      setQueue(newQueue);
      setCurrentQueueIndex(0);
      setImportedCount(0);
      // Load first acta
      setParsedActa(newQueue[0].parsedActa);
      setFileName(newQueue[0].fileName);
      setStep('preview');
    }

    if (errors.length > 0) {
      setError(`${errors.length} archivo(s) no se pudieron leer: ${errors.join('; ')}`);
    }
  }, []);

  // Legacy single-file handler
  const handleFile = useCallback(async (file: File) => {
    handleFiles([file]);
  }, [handleFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const handleImport = () => {
    if (!parsedActa || !matchedHome || !matchedAway) return;

    try {
      // Override acta scores if manual forfeit is selected
      const importActa = manualForfeit !== 'none'
        ? {
            ...parsedActa,
            homeScore: manualForfeit === 'home' ? 0 : 20,
            awayScore: manualForfeit === 'away' ? 0 : 20,
          }
        : parsedActa;

      const result = executeImport(
        importActa,
        matchedHome.id,
        matchedAway.id,
        effectiveMatchday,
        selectedMatchType,
        matches,
        playerStats,
        players,
        teams,
        fileName,
      );

      // Save everything via context
      updateMatches(result.updatedMatches);
      updatePlayerStats(result.updatedPlayerStats);
      updatePlayers(result.updatedPlayers);
      updateStandings(result.updatedStandings);
      addImportRecord(result.importRecord);

      // Mark queue item as imported
      setQueue(prev => prev.map((item, i) =>
        i === currentQueueIndex ? { ...item, status: 'imported' } : item
      ));
      setImportedCount(prev => prev + 1);

      setImportResult(result);

      // Check if there are more actas in the queue
      const nextIndex = currentQueueIndex + 1;
      if (nextIndex < queue.length) {
        setStep('done'); // Show success briefly, user clicks "Siguiente"
      } else {
        setStep('done');
      }
    } catch (err: any) {
      setError(`Error al importar: ${err.message}`);
    }
  };

  // Advance to next acta in queue
  const handleNextInQueue = () => {
    const nextIndex = currentQueueIndex + 1;
    if (nextIndex < queue.length) {
      setCurrentQueueIndex(nextIndex);
      setParsedActa(queue[nextIndex].parsedActa);
      setFileName(queue[nextIndex].fileName);
      setError(null);
      setImportResult(null);
      setManualForfeit('none');
      setStep('preview');
    } else {
      handleReset();
    }
  };

  // Skip current acta
  const handleSkip = () => {
    setQueue(prev => prev.map((item, i) =>
      i === currentQueueIndex ? { ...item, status: 'skipped' } : item
    ));
    handleNextInQueue();
  };

  const handleReset = () => {
    setStep('upload');
    setParsedActa(null);
    setError(null);
    setFileName('');
    setImportResult(null);
    setQueue([]);
    setCurrentQueueIndex(0);
    setImportedCount(0);
    setManualForfeit('none');
  };

  const hasMoreInQueue = currentQueueIndex + 1 < queue.length;

  const newPlayersCount = homePlayerPreview.filter(p => p.isNew).length + awayPlayerPreview.filter(p => p.isNew).length;

  // Auto-suggest forfeit when one team has < 5 players
  const autoForfeitSuggestion = useMemo((): 'home' | 'away' | null => {
    if (!parsedActa) return null;
    const homeLow = detectForfeit(parsedActa.homePlayers);
    const awayLow = detectForfeit(parsedActa.awayPlayers);
    // Only auto-suggest when exactly one team has < 5 players
    if (homeLow && !awayLow) return 'home';
    if (awayLow && !homeLow) return 'away';
    return null;
  }, [parsedActa]);

  // Apply auto-suggestion on acta load (only if not already manually set)
  const forfeitPreview = useMemo((): ForfeitInfo | null => {
    const effectiveForfeit = manualForfeit !== 'none' ? manualForfeit : null;
    if (!effectiveForfeit) return null;
    return {
      isForfeit: true,
      forfeitTeam: effectiveForfeit,
      homeScore: effectiveForfeit === 'home' ? 0 : 20,
      awayScore: effectiveForfeit === 'away' ? 0 : 20,
    };
  }, [manualForfeit]);

  const canImport = matchedHome && matchedAway && !duplicateMatch && effectiveMatchday > 0;

  return (
    <>
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="section animate-fade-in-up">
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <FileSpreadsheet size={48} style={{ color: 'var(--color-primary)', marginBottom: 'var(--space-3)' }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                Importar Actas FBM
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                Sube uno o varios archivos Excel (.xlsx) exportados desde la app de la FBM.
                El sistema detectará equipos, jugadores y estadísticas automáticamente.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-12) var(--space-6)',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                background: isDragging ? 'rgba(0, 122, 255, 0.04)' : 'var(--color-bg-secondary)',
              }}
              onClick={() => document.getElementById('acta-upload')?.click()}
            >
              <Upload size={32} style={{ color: isDragging ? 'var(--color-primary)' : 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }} />
              <p style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                {isDragging ? 'Suelta los archivos aquí' : 'Arrastra las actas aquí'}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                o haz clic para seleccionar uno o varios archivos .xlsx
              </p>
              <input
                id="acta-upload"
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) handleFiles(files);
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
            </div>

            {error && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 59, 48, 0.08)',
                border: '1px solid rgba(255, 59, 48, 0.2)',
                color: 'var(--color-danger)',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && parsedActa && (
        <div className="animate-fade-in-up">
          {/* Queue progress indicator */}
          {queue.length > 1 && (
            <div className="section" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3) var(--space-5)',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(0, 122, 255, 0.04)',
                border: '1px solid rgba(0, 122, 255, 0.12)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <Layers size={18} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    Acta {currentQueueIndex + 1} de {queue.length}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    — {fileName}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {importedCount > 0 && (
                    <span className="badge badge-win" style={{ fontSize: '10px' }}>
                      {importedCount} importada{importedCount > 1 ? 's' : ''}
                    </span>
                  )}
                  <span style={{
                    fontSize: '10px',
                    color: 'var(--color-text-tertiary)',
                    background: 'var(--color-bg-secondary)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 600,
                  }}>
                    {queue.length - currentQueueIndex - 1} restante{queue.length - currentQueueIndex - 1 !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 'var(--space-2)', height: 3, borderRadius: 'var(--radius-full)', background: 'var(--color-bg-secondary)' }}>
                <div style={{
                  height: '100%',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-primary)',
                  width: `${((currentQueueIndex + 1) / queue.length) * 100}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}

          {/* Match header */}
          <div className="section" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
              <TeamDisplay
                team={matchedHome}
                actaName={parsedActa.homeTeamName}
                score={forfeitPreview ? forfeitPreview.homeScore : parsedActa.homeScore}
                isForfeit={forfeitPreview?.forfeitTeam === 'home'}
              />
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 900,
                color: 'var(--color-text-tertiary)',
              }}>
                VS
              </div>
              <TeamDisplay
                team={matchedAway}
                actaName={parsedActa.awayTeamName}
                score={forfeitPreview ? forfeitPreview.awayScore : parsedActa.awayScore}
                isForfeit={forfeitPreview?.forfeitTeam === 'away'}
              />
            </div>

            {/* Forfeit info */}
            {forfeitPreview && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 149, 0, 0.08)',
                border: '1px solid rgba(255, 149, 0, 0.2)',
                color: '#E8A317',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <AlertCircle size={16} />
                <div>
                  <strong>🚫 Incomparecencia:</strong>{' '}
                  {forfeitPreview.forfeitTeam === 'home' ? matchedHome?.name || parsedActa.homeTeamName : matchedAway?.name || parsedActa.awayTeamName}{' '}
                  no se presentó.
                  El resultado se registrará como <strong>{forfeitPreview.homeScore} - {forfeitPreview.awayScore}</strong>.
                  No se guardarán estadísticas individuales.
                </div>
              </div>
            )}

            {/* Duplicate warning */}
            {duplicateMatch && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 149, 0, 0.08)',
                border: '1px solid rgba(255, 149, 0, 0.2)',
                color: '#E8A317',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <AlertCircle size={16} />
                ⚠️ Este partido ya existe (Jornada {duplicateMatch.matchday}, resultado {duplicateMatch.homeScore}-{duplicateMatch.awayScore}). No se puede importar de nuevo.
              </div>
            )}
          </div>

          {/* Import options */}
          <div className="section" style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Calendar size={18} /> Opciones de importación
            </h3>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Competición</label>
                <select
                  value={selectedMatchType}
                  onChange={(e) => setSelectedMatchType(e.target.value as any)}
                  style={selectStyle}
                >
                  <option value="regular">Liga Regular</option>
                  <option value="copa">Copa de Cristo Rey</option>
                  <option value="playoff">Playoff</option>
                </select>
              </div>

              {/* Auto-detected matchday for Liga */}
              {selectedMatchType === 'regular' && matchedHome && matchedAway && (
                <div>
                  <label style={labelStyle}>Jornada</label>
                  {autoDetectedMatch ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(52, 199, 89, 0.08)',
                      border: '1px solid rgba(52, 199, 89, 0.2)',
                    }}>
                      <Check size={14} style={{ color: 'var(--color-success)' }} />
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
                        Jornada {autoDetectedMatch.matchday}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                        (detectada automáticamente)
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 59, 48, 0.08)',
                      border: '1px solid rgba(255, 59, 48, 0.2)',
                    }}>
                      <AlertCircle size={14} style={{ color: 'var(--color-danger)' }} />
                      <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                        No hay partido programado entre estos equipos
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Manual matchday for Copa/Playoff */}
              {selectedMatchType !== 'regular' && (
                <div>
                  <label style={labelStyle}>Jornada / Ronda</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={manualMatchday}
                    onChange={(e) => setManualMatchday(parseInt(e.target.value) || 1)}
                    style={{ ...selectStyle, width: 120 }}
                  />
                </div>
              )}
              {/* Forfeit selector */}
              <div>
                <label style={labelStyle}>Incomparecencia</label>
                <select
                  value={manualForfeit}
                  onChange={(e) => setManualForfeit(e.target.value as any)}
                  style={selectStyle}
                >
                  <option value="none">No hay incomparecencia</option>
                  <option value="home">
                    {matchedHome?.shortName || parsedActa.homeTeamName} no se presentó
                  </option>
                  <option value="away">
                    {matchedAway?.shortName || parsedActa.awayTeamName} no se presentó
                  </option>
                </select>
                {autoForfeitSuggestion && manualForfeit === 'none' && (
                  <div style={{
                    marginTop: 'var(--space-1)',
                    fontSize: '10px',
                    color: '#E8A317',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    cursor: 'pointer',
                  }}
                    onClick={() => setManualForfeit(autoForfeitSuggestion)}
                  >
                    <AlertCircle size={10} />
                    Sugerencia: {autoForfeitSuggestion === 'home' ? matchedHome?.shortName : matchedAway?.shortName} (&lt;5 jugadores).
                    <span style={{ textDecoration: 'underline' }}>Aplicar</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Player matching preview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-4)' }}>
            <PlayerPreviewTable
              title={matchedHome?.name || parsedActa.homeTeamName}
              team={matchedHome}
              preview={homePlayerPreview}
            />
            <PlayerPreviewTable
              title={matchedAway?.name || parsedActa.awayTeamName}
              team={matchedAway}
              preview={awayPlayerPreview}
            />
          </div>

          {/* Summary + Actions */}
          <div className="section" style={{ marginTop: 'var(--space-4)' }}>
            {newPlayersCount > 0 && (
              <div style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 122, 255, 0.06)',
                border: '1px solid rgba(0, 122, 255, 0.15)',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <UserPlus size={16} style={{ color: 'var(--color-primary)' }} />
                <span><strong>{newPlayersCount}</strong> jugador{newPlayersCount > 1 ? 'es' : ''} nuevo{newPlayersCount > 1 ? 's' : ''} se creará{newPlayersCount > 1 ? 'n' : ''} automáticamente.</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={handleReset} style={btnSecondary}>
                {queue.length > 1 ? 'Cancelar todo' : 'Cancelar'}
              </button>
              {queue.length > 1 && (
                <button onClick={handleSkip} style={btnSecondary}>
                  <SkipForward size={14} />
                  Saltar esta acta
                </button>
              )}
              <button
                onClick={handleImport}
                disabled={!canImport}
                style={{
                  ...btnPrimary,
                  opacity: canImport ? 1 : 0.5,
                  cursor: canImport ? 'pointer' : 'not-allowed',
                }}
              >
                <Zap size={16} />
                Importar partido
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 59, 48, 0.08)',
                border: '1px solid rgba(255, 59, 48, 0.2)',
                color: 'var(--color-danger)',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && importResult && (
        <div className="section animate-fade-in-up" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 'var(--radius-full)',
            background: 'rgba(52, 199, 89, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-5)',
          }}>
            <Check size={40} style={{ color: 'var(--color-success)' }} />
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            ¡Importación completada!
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
            {importResult.forfeitInfo?.isForfeit
              ? 'Partido registrado como incomparecencia (20-0). Sin estadísticas individuales.'
              : 'El partido ha sido registrado correctamente.'}
          </p>

          {/* Stats summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-6)',
          }}>
            <div className="card-flat" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-1)' }}>
                Stats registradas
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--color-primary)' }}>
                {importResult.homeStats.length + importResult.awayStats.length}
              </div>
            </div>
            <div className="card-flat" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-1)' }}>
                {importResult.forfeitInfo?.isForfeit ? 'Tipo' : 'Jugadores nuevos'}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 900, color: importResult.forfeitInfo?.isForfeit ? 'var(--color-danger)' : importResult.newPlayers.length > 0 ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                {importResult.forfeitInfo?.isForfeit ? '🚫' : importResult.newPlayers.length}
              </div>
            </div>
            <div className="card-flat" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-1)' }}>
                Resultado
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 900 }}>
                {importResult.match.homeScore}-{importResult.match.awayScore}
              </div>
            </div>
          </div>

          {/* New players detail */}
          {importResult.newPlayers.length > 0 && (
            <div style={{
              marginBottom: 'var(--space-5)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(0, 122, 255, 0.04)',
              border: '1px solid rgba(0, 122, 255, 0.1)',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
                🆕 Jugadores creados automáticamente
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                {importResult.newPlayers.map(p => `#${p.number} ${p.name}`).join(' · ')}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
                Puedes editar sus datos en Admin → Jugadores
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            {hasMoreInQueue ? (
              <button onClick={handleNextInQueue} style={btnPrimary}>
                <ChevronRight size={16} />
                Siguiente acta ({queue.length - currentQueueIndex - 1} restante{queue.length - currentQueueIndex - 1 !== 1 ? 's' : ''})
              </button>
            ) : (
              <button onClick={handleReset} style={btnPrimary}>
                <Upload size={16} />
                {queue.length > 1 ? `Listo (${importedCount} importada${importedCount > 1 ? 's' : ''})` : 'Importar otro partido'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Import History */}
      {importHistory.length > 0 && step === 'upload' && (
        <div className="section animate-fade-in-up delay-1" style={{ marginTop: 'var(--space-6)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Clock size={18} /> Historial de importaciones
          </h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Jornada</th>
                  <th>Partido</th>
                  <th>Resultado</th>
                  <th>Tipo</th>
                  <th>Fecha imp.</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((record) => {
                  const home = teams.find(t => t.id === record.homeTeamId);
                  const away = teams.find(t => t.id === record.awayTeamId);
                  return (
                    <tr key={record.matchId}>
                      <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>J{record.matchday}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          {home && <TeamLogo team={home} size="sm" />}
                          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                            {home?.shortName || '?'} vs {away?.shortName || '?'}
                          </span>
                          {away && <TeamLogo team={away} size="sm" />}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                        {record.homeScore} - {record.awayScore}
                      </td>
                      <td>
                        <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                          {record.matchType === 'regular' ? 'Liga' : record.matchType === 'copa' ? 'Copa' : 'Playoff'}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                        {new Date(record.importedAt).toLocaleDateString('es-ES')}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            if (confirm('¿Eliminar esta importación? Se borrarán las stats del partido.')) {
                              // Remove match stats and revert match
                              const newStats = playerStats.filter(ps => ps.matchId !== record.matchId);
                              const newMatches = matches.map(m =>
                                m.id === record.matchId
                                  ? { ...m, isPlayed: false, homeScore: null, awayScore: null }
                                  : m
                              );
                              updatePlayerStats(newStats);
                              updateMatches(newMatches);
                              updateStandings(
                                (() => {
                                  const { recalculateStandings } = require('@/lib/importEngine');
                                  return recalculateStandings(newMatches, teams);
                                })()
                              );
                              removeImportRecord(record.matchId);
                            }
                          }}
                          style={{
                            width: 28,
                            height: 28,
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
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function TeamDisplay({ team, actaName, score, isForfeit }: { team?: Team; actaName: string; score: number; isForfeit?: boolean }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 140 }}>
      {team ? (
        <>
          <TeamLogo team={team} size="lg" />
          <div style={{ fontWeight: 700, marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
            {team.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', justifyContent: 'center', marginTop: 'var(--space-1)' }}>
            {isForfeit ? (
              <>
                <AlertCircle size={12} style={{ color: 'var(--color-danger)' }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', fontWeight: 600 }}>No presentado</span>
              </>
            ) : (
              <>
                <Check size={12} style={{ color: 'var(--color-success)' }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>Detectado</span>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255, 59, 48, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}>
            <AlertCircle size={24} style={{ color: 'var(--color-danger)' }} />
          </div>
          <div style={{ fontWeight: 600, marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
            {actaName}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>No reconocido</div>
        </>
      )}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-3xl)',
        fontWeight: 900,
        marginTop: 'var(--space-3)',
        color: isForfeit ? 'var(--color-danger)' : undefined,
      }}>
        {score}
      </div>
    </div>
  );
}

interface PlayerPreviewItem {
  line: ParsedPlayerLine;
  player: { id: string; name: string; number: string };
  isNew: boolean;
}

function PlayerPreviewTable({ title, team, preview }: { title: string; team?: Team; preview: PlayerPreviewItem[] }) {
  if (!team) return null;

  return (
    <div className="section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <TeamLogo team={team} size="sm" />
        <h4 style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{title}</h4>
        <span style={{
          fontSize: '10px',
          color: 'var(--color-text-tertiary)',
          background: 'var(--color-bg-secondary)',
          padding: '2px 6px',
          borderRadius: 'var(--radius-full)',
        }}>
          {preview.length} jugadores
        </span>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 35 }}>#</th>
              <th>Jugador</th>
              <th className="text-center">PTS</th>
              <th className="text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {preview.map(({ line, player, isNew }) => (
              <tr key={line.number}>
                <td style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: team.primaryColor }}>
                  {line.number}
                </td>
                <td>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {line.name}
                  </span>
                </td>
                <td className="text-center" style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  {line.points}
                </td>
                <td className="text-center">
                  {isNew ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(0, 122, 255, 0.08)',
                      color: 'var(--color-primary)',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}>
                      <UserPlus size={10} /> Nuevo
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(52, 199, 89, 0.08)',
                      color: 'var(--color-success)',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}>
                      <Check size={10} /> OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// STYLES
// ============================================

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 'var(--space-2)',
};

const selectStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-card)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-3) var(--space-6)',
  borderRadius: 'var(--radius-full)',
  border: 'none',
  background: 'var(--color-primary)',
  color: '#fff',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};

const btnSecondary: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-3) var(--space-6)',
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-card)',
  color: 'var(--color-text-secondary)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};
