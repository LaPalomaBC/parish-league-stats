/**
 * Parser determinista de actas FBM en formato Excel (.xlsx)
 * 
 * Formato esperado:
 * - Fila con "Estadísticas - EQUIPO1 vs EQUIPO2 - ..."
 * - Secciones por equipo con cabecera "Num., Nombre, MIN, PTS, ..."
 * - Filas de jugadores con stats
 * - Fila TOTALES al final de cada sección
 */
import * as XLSX from 'xlsx';
import type { ParsedActa, ParsedPlayerLine } from './types';

/**
 * Parsea un archivo de acta FBM en formato .xlsx
 * @param buffer - ArrayBuffer del archivo Excel
 * @returns ParsedActa con todos los datos del partido
 */
export function parseActaExcel(buffer: ArrayBuffer): ParsedActa {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
  });

  // 1. Buscar la línea "Estadísticas - EQUIPO1 vs EQUIPO2 - ..."
  let matchInfo = { homeTeam: '', awayTeam: '', season: '' };
  for (const row of rows) {
    const cell = String(row[0] ?? '');
    if (cell.startsWith('Estadísticas -') || cell.includes(' vs ')) {
      const parts = cell.replace('Estadísticas - ', '').split(' - ');
      const teams = parts[0].split(' vs ');
      matchInfo.homeTeam = teams[0]?.trim() ?? '';
      matchInfo.awayTeam = teams[1]?.trim() ?? '';
      matchInfo.season = parts.find(p => /\d{2}\/\d{2}$/.test(p.trim()))?.trim() ?? '';
      break;
    }
  }

  // 2. Encontrar las secciones de cada equipo
  // Buscar filas que contengan exactamente el nombre de un equipo (antes de la cabecera de stats)
  const teamSections: { teamName: string; startRow: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cell0 = String(row[0] ?? '').trim();
    // Buscar cabecera "Num." que indica inicio de datos
    if (cell0 === 'Num.' || cell0 === 'Num') {
      // El nombre del equipo está en una fila anterior cercana
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const teamCell = String(rows[j][0] ?? '').trim();
        if (teamCell && teamCell !== '' && teamCell !== 'TOTALES' && !teamCell.includes('TC 2P') && !teamCell.includes('Estadísticas')) {
          teamSections.push({ teamName: teamCell, startRow: i });
          break;
        }
      }
    }
  }

  // 3. Parsear jugadores de cada sección
  function parseTeamSection(headerRowIndex: number): { players: ParsedPlayerLine[]; totalScore: number } {
    const playerLines: ParsedPlayerLine[] = [];
    let totalScore = 0;
    
    // Las filas de datos empiezan después de la cabecera (headerRowIndex + 1)
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;
      
      const num = String(row[0] ?? '').trim();
      const name = String(row[1] ?? '').trim();
      
      // Fila TOTALES = fin de la sección
      if (num === '' && name === 'TOTALES') {
        totalScore = toNum(row[3]);
        break;
      }
      
      // Fila vacía — saltar
      if (!name || name === '') continue;
      
      // Parsear minutos "mm:ss" → número de minutos
      const minStr = String(row[2] ?? '00:00');
      const minutes = parseMinutes(minStr);
      
      // Parsear campos A/I (anotados/intentados)
      const twoAI = parseAI(String(row[4] ?? '0/0'));
      const threeAI = parseAI(String(row[6] ?? '0/0'));
      const ftAI = parseAI(String(row[8] ?? '0/0'));
      
      playerLines.push({
        number: num,
        name: cleanPlayerName(name),
        minutes,
        points: toNum(row[3]),
        twoMade: twoAI.made,
        twoAttempted: twoAI.attempted,
        threeMade: threeAI.made,
        threeAttempted: threeAI.attempted,
        ftMade: ftAI.made,
        ftAttempted: ftAI.attempted,
        defRebounds: toNum(row[10]),
        offRebounds: toNum(row[11]),
        assists: toNum(row[13]),
        recoveries: toNum(row[14]),
        turnovers: toNum(row[15]),
        blocks: toNum(row[16]),
        blocksReceived: toNum(row[17]),
        fouls: toNum(row[18]),
        foulsReceived: toNum(row[19]),
        efficiency: toNum(row[20]),
        plusMinus: toNum(row[21]),
      });
    }
    
    return { players: playerLines, totalScore };
  }

  if (teamSections.length < 2) {
    throw new Error('No se pudieron detectar las secciones de los dos equipos en el acta.');
  }

  const homeSection = parseTeamSection(teamSections[0].startRow);
  const awaySection = parseTeamSection(teamSections[1].startRow);

  return {
    homeTeamName: teamSections[0].teamName || matchInfo.homeTeam,
    awayTeamName: teamSections[1].teamName || matchInfo.awayTeam,
    homeScore: homeSection.totalScore,
    awayScore: awaySection.totalScore,
    season: matchInfo.season,
    homePlayers: homeSection.players.filter(p => p.minutes > 0 || p.points > 0),
    awayPlayers: awaySection.players.filter(p => p.minutes > 0 || p.points > 0),
  };
}

// === Helpers ===

function toNum(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function parseMinutes(minStr: string): number {
  // Formato "mm:ss" → minutos redondeados
  const parts = minStr.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10) || 0;
    const s = parseInt(parts[1], 10) || 0;
    return m + Math.round(s / 60);
  }
  return parseInt(minStr, 10) || 0;
}

function parseAI(aiStr: string): { made: number; attempted: number } {
  const parts = aiStr.split('/');
  if (parts.length === 2) {
    return {
      made: parseInt(parts[0], 10) || 0,
      attempted: parseInt(parts[1], 10) || 0,
    };
  }
  return { made: 0, attempted: 0 };
}

function cleanPlayerName(raw: string): string {
  // Formato FBM: "APELLIDO(S), NOMBRE" → "Nombre Apellido(s)"
  // Quitar comillas
  let name = raw.replace(/"/g, '').trim();
  
  if (name.includes(',')) {
    const [apellidos, nombre] = name.split(',').map(s => s.trim());
    // Capitalizar apropiadamente
    const cap = (s: string) => s.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    return `${cap(nombre)} ${cap(apellidos)}`;
  }
  return name;
}
