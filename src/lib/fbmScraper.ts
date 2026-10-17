/**
 * FBM Scraper — Extrae resultados de la Parish League desde fbm.es
 *
 * La web de la FBM usa ASP.NET WebForms con ViewState.
 * Hay que navegar el formulario con POSTs secuenciales para llegar
 * a los datos del grupo "Parish League > LIGA REGULAR > ÚNICO".
 *
 * Solo extrae datos PÚBLICOS de la web (marcadores, fechas, horarios, campos).
 * Las estadísticas individuales de jugadores NO están disponibles públicamente.
 */

// ============================================
// FBM IDs (fijos para la temporada 2026/27)
// ============================================

/** FBM delegation ID for Parish League */
const FBM_DELEGACION = '10';
/** FBM competition ID for PARISH LEAGUE */
const FBM_COMPETICION = '15677';
/** FBM category ID for Senior Masculino */
const FBM_CATEGORIA = '17134';
/** FBM phase ID for LIGA REGULAR */
const FBM_FASE = '7866';
/** FBM group ID for ÚNICO */
const FBM_GRUPO = '17541';

const FBM_URL = 'https://www.fbm.es/es/horarios-y-resultados';
const FORM_PREFIX = 'ctl00$ctl00$contenedor_informacion$contenedor_informacion_con_lateral_formulario$';

/** Maps FBM team IDs → internal Parish League Stats team IDs */
const FBM_TEAM_MAP: Record<string, string> = {
  '838848': 'team-08', // BEGOÑA BULLS
  '838849': 'team-01', // LA PALOMA B.C.
  '838850': 'team-03', // TRIGOLUTION MAGIKIKOS JyM
  '838851': 'team-06', // BETSAIDA BOANERGES
  '838852': 'team-10', // LOS ÁNGELES PRAYERS
  '838853': 'team-04', // SIENA SUNS
  '838854': 'team-05', // SALTERIO LAUDERS
  '838855': 'team-02', // LABOURÉ SPINNERS
  '838856': 'team-09', // THE VALVA CHERUBS
  '838857': 'team-07', // SNOW KNIGHTS
};

// ============================================
// Types
// ============================================

export interface FbmMatch {
  jornada: number;
  homeTeamFbmId: string;
  homeTeam: string;
  awayTeamFbmId: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  date: string | null;     // "DD/MM/YYYY"
  time: string | null;     // "HH:MM"
  venue: string | null;
  isPlayed: boolean;
}

export interface SyncResult {
  /** Total matches scraped from FBM */
  totalScraped: number;
  /** Matches that had score changes (new results) */
  scoresUpdated: number;
  /** Matches that had date/time/venue changes */
  scheduleUpdated: number;
  /** Details of each change */
  changes: string[];
  /** Any errors during scraping */
  errors: string[];
}

// ============================================
// HTML Parsing Helpers
// ============================================

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

/** Extract hidden form fields (__VIEWSTATE, __EVENTVALIDATION, etc.) */
function extractHiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const regex = /<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    fields[match[1]] = decodeHtmlEntities(match[2]);
  }
  return fields;
}

/** Extract selected values from dropdown selects */
function extractSelectedValues(html: string): Record<string, string> {
  const names = ['DDLDelegacion', 'DDLCompeticiones', 'DDLCategorias', 'DDLFases', 'DDLGrupos'];
  const selected: Record<string, string> = {};
  for (const name of names) {
    const selectRegex = new RegExp(`<select[^>]*${name}"[^>]*>(.*?)</select>`, 's');
    const selectMatch = html.match(selectRegex);
    if (!selectMatch) continue;
    const optionRegex = /selected[^>]*value="([^"]*)"/;
    const optMatch = selectMatch[1].match(optionRegex);
    if (optMatch) selected[name] = optMatch[1];
  }
  return selected;
}

// ============================================
// ASP.NET WebForms Navigation
// ============================================

/**
 * Navigates the FBM WebForms to reach the Parish League results page.
 * Returns the final HTML with calendar/results data.
 */
export async function fetchFbmPage(): Promise<string> {
  // Step 1: GET the initial page to obtain ViewState and cookies
  const initialRes = await fetch(FBM_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ParishLeagueStats/1.0)' },
  });
  if (!initialRes.ok) throw new Error(`FBM initial GET failed: ${initialRes.status}`);

  let html = await initialRes.text();

  // Extract Set-Cookie headers for session
  const cookies = initialRes.headers.getSetCookie?.()
    || (initialRes.headers.get('set-cookie')?.split(',').map(c => c.trim()) ?? []);
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

  // Step 2: POST to select Parish League delegation
  html = await postFormField(html, cookieHeader, 'DDLDelegacion', {
    DDLDelegacion: FBM_DELEGACION,
  });

  // Step 3: POST to select the group (all other fields auto-populate)
  html = await postFormField(html, cookieHeader, 'DDLGrupos', {
    DDLDelegacion: FBM_DELEGACION,
    DDLCompeticiones: FBM_COMPETICION,
    DDLCategorias: FBM_CATEGORIA,
    DDLFases: FBM_FASE,
    DDLGrupos: FBM_GRUPO,
  });

  return html;
}

async function postFormField(
  currentHtml: string,
  cookieHeader: string,
  targetField: string,
  overrides: Record<string, string>,
): Promise<string> {
  const hidden = extractHiddenFields(currentHtml);
  const selected = extractSelectedValues(currentHtml);

  const body = new URLSearchParams();

  // Add hidden fields
  for (const [key, value] of Object.entries(hidden)) {
    body.set(key, value);
  }

  // Add currently selected dropdown values
  for (const [name, value] of Object.entries(selected)) {
    body.set(`${FORM_PREFIX}${name}`, value);
  }

  // Apply overrides
  for (const [name, value] of Object.entries(overrides)) {
    body.set(`${FORM_PREFIX}${name}`, value);
  }

  // Set the event target
  body.set('__EVENTTARGET', `${FORM_PREFIX}${targetField}`);
  body.set('__EVENTARGUMENT', '');

  const res = await fetch(FBM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (compatible; ParishLeagueStats/1.0)',
      Cookie: cookieHeader,
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`FBM POST ${targetField} failed: ${res.status}`);
  return res.text();
}

// ============================================
// Match Data Parser
// ============================================

/**
 * Parses the FBM results page HTML and extracts all matches
 * from the calendar section.
 */
export function parseFbmMatches(html: string): FbmMatch[] {
  // Find calendar section
  const calSection = html.match(/id="calendario"([\s\S]*?)(?=id="equipos"|$)/);
  if (!calSection) return [];

  const cal = calSection[1];

  // Split by jornada headers
  const jornadaBlocks = cal.split(/(?=Jornada\s+\d+\s*-)/).filter(b => /Jornada/.test(b));

  const teamLinkRegex = /<a[^>]*href="\/equipo-(\d+)-\d+\/[^"]*"[^>]*>([^<]+)<\/a>/g;
  const matches: FbmMatch[] = [];

  for (const block of jornadaBlocks) {
    const jMatch = block.match(/Jornada\s+(\d+)/);
    if (!jMatch) continue;
    const jornada = parseInt(jMatch[1]);

    // Find all team links in this block
    const teamLinks: { id: string; name: string; index: number }[] = [];
    let linkMatch;
    const localRegex = new RegExp(teamLinkRegex.source, 'g');
    while ((linkMatch = localRegex.exec(block)) !== null) {
      teamLinks.push({
        id: linkMatch[1],
        name: decodeHtmlEntities(linkMatch[2].trim()),
        index: linkMatch.index,
      });
    }

    // Group team links in pairs (home, away)
    for (let i = 0; i < teamLinks.length - 1; i += 2) {
      const home = teamLinks[i];
      const away = teamLinks[i + 1];

      // Extract scores between team links
      const between = block.substring(home.index + home.name.length, away.index);
      const scoreMatches = between.match(/>(\d{1,3})</g);
      const scores = scoreMatches?.map(s => parseInt(s.replace(/[><]/g, ''))) ?? [];

      // Extract date/time/venue after away team
      const after = block.substring(away.index, away.index + 500);
      const dateMatch = after.match(/(\d{2}\/\d{2}\/\d{4})/);
      const timeMatch = after.match(/(\d{2}:\d{2})/);
      const venueMatch = after.match(/(PAB[^<\n]*|COLEGIO[^<\n]*|INST[^<\n]*)/);

      matches.push({
        jornada,
        homeTeamFbmId: home.id,
        homeTeam: home.name,
        awayTeamFbmId: away.id,
        awayTeam: away.name,
        homeScore: scores.length >= 2 ? scores[0] : null,
        awayScore: scores.length >= 2 ? scores[1] : null,
        date: dateMatch?.[1] ?? null,
        time: timeMatch?.[1] ?? null,
        venue: venueMatch ? decodeHtmlEntities(venueMatch[1].trim()) : null,
        isPlayed: scores.length >= 2,
      });
    }
  }

  return matches;
}

// ============================================
// Sync Logic
// ============================================

import type { Match } from './types';

/**
 * Converts FBM date "DD/MM/YYYY" → ISO "YYYY-MM-DD"
 */
function fbmDateToIso(fbmDate: string): string {
  const [dd, mm, yyyy] = fbmDate.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Maps an FBM team ID to the internal Parish League Stats team ID.
 */
export function mapFbmTeamId(fbmId: string): string | undefined {
  return FBM_TEAM_MAP[fbmId];
}

/**
 * Finds the matching internal match for an FBM match.
 * Matches by homeTeamId + awayTeamId + matchday.
 */
function findInternalMatch(fbm: FbmMatch, internalMatches: Match[]): Match | undefined {
  const homeId = mapFbmTeamId(fbm.homeTeamFbmId);
  const awayId = mapFbmTeamId(fbm.awayTeamFbmId);
  if (!homeId || !awayId) return undefined;

  return internalMatches.find(m =>
    m.homeTeamId === homeId &&
    m.awayTeamId === awayId &&
    m.matchday === fbm.jornada
  );
}

/**
 * Compares FBM data with internal data and returns updated matches + a summary.
 * Does NOT write to Supabase — caller is responsible for that.
 */
export function computeSyncChanges(
  fbmMatches: FbmMatch[],
  internalMatches: Match[],
): { updatedMatches: Match[]; result: SyncResult } {
  const result: SyncResult = {
    totalScraped: fbmMatches.length,
    scoresUpdated: 0,
    scheduleUpdated: 0,
    changes: [],
    errors: [],
  };

  // Deep copy so we don't mutate the original
  const updatedMatches = internalMatches.map(m => ({ ...m }));

  for (const fbm of fbmMatches) {
    const homeId = mapFbmTeamId(fbm.homeTeamFbmId);
    const awayId = mapFbmTeamId(fbm.awayTeamFbmId);

    if (!homeId || !awayId) {
      result.errors.push(`Unknown FBM team: ${fbm.homeTeamFbmId} or ${fbm.awayTeamFbmId}`);
      continue;
    }

    const internal = updatedMatches.find(m =>
      m.homeTeamId === homeId &&
      m.awayTeamId === awayId &&
      m.matchday === fbm.jornada
    );

    if (!internal) {
      result.errors.push(
        `No internal match found for J${fbm.jornada} ${fbm.homeTeam} vs ${fbm.awayTeam}`
      );
      continue;
    }

    let changed = false;

    // --- Score update ---
    if (fbm.isPlayed && !internal.isPlayed) {
      internal.homeScore = fbm.homeScore;
      internal.awayScore = fbm.awayScore;
      internal.isPlayed = true;
      result.scoresUpdated++;
      result.changes.push(
        `✅ J${fbm.jornada} ${fbm.homeTeam} ${fbm.homeScore}-${fbm.awayScore} ${fbm.awayTeam} — NUEVO RESULTADO`
      );
      changed = true;
    } else if (
      fbm.isPlayed &&
      internal.isPlayed &&
      (internal.homeScore !== fbm.homeScore || internal.awayScore !== fbm.awayScore)
    ) {
      // Score correction (rare but possible)
      const oldScore = `${internal.homeScore}-${internal.awayScore}`;
      internal.homeScore = fbm.homeScore;
      internal.awayScore = fbm.awayScore;
      result.scoresUpdated++;
      result.changes.push(
        `⚠️ J${fbm.jornada} ${fbm.homeTeam} — Score changed: ${oldScore} → ${fbm.homeScore}-${fbm.awayScore}`
      );
      changed = true;
    }

    // --- Date/time update ---
    if (fbm.date) {
      const isoDate = fbmDateToIso(fbm.date);
      if (internal.matchDate !== isoDate) {
        const oldDate = internal.matchDate || 'sin fecha';
        internal.matchDate = isoDate;
        result.scheduleUpdated++;
        result.changes.push(
          `📅 J${fbm.jornada} ${fbm.homeTeam} vs ${fbm.awayTeam} — Fecha: ${oldDate} → ${isoDate}`
        );
        changed = true;
      }
    }

    if (fbm.time && internal.matchTime !== fbm.time) {
      const oldTime = internal.matchTime || 'sin hora';
      internal.matchTime = fbm.time;
      if (!changed) result.scheduleUpdated++;
      result.changes.push(
        `🕐 J${fbm.jornada} ${fbm.homeTeam} vs ${fbm.awayTeam} — Hora: ${oldTime} → ${fbm.time}`
      );
      changed = true;
    }

    // --- Venue update ---
    if (fbm.venue && !internal.venue) {
      internal.venue = fbm.venue;
    }
  }

  return { updatedMatches, result };
}
