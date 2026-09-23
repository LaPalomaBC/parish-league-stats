<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Parish League Stats — Contexto Completo del Proyecto

> Aplicación web de estadísticas para la **Liga Parroquial de Baloncesto de Madrid**.  
> Soporta **múltiples temporadas** con archivo histórico. Temporada activa: **2026/27**.  
> Creada por **Josugeos**. El equipo principal del propietario es **La Paloma BC** (`team-01`).

---

## 1. Tech Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | **Next.js** (App Router) | `16.2.9` |
| Lenguaje | **TypeScript** (strict) | `^5` |
| UI Library | **React** | `19.2.4` |
| Estilos | **Vanilla CSS** (design tokens) | — |
| Base de datos | **Supabase** (PostgreSQL, tabla `data_store`) | `^2.108.2` |
| Charts | **Recharts** | `^3.8.1` |
| Icons | **Lucide React** | `^1.18.0` |
| Excel parsing | **xlsx** (SheetJS) | `^0.18.5` |
| Screenshot | **html-to-image** | `^1.11.13` |
| Fonts | **Inter** (body) + **Outfit** (display), via `next/font/google` | — |
| Lint | **ESLint** 9 + `eslint-config-next` | — |
| Deploy | **Vercel** (presumido por `.vercel` en .gitignore) | — |
| AI Chat | **Gemini API** (generativelanguage.googleapis.com) | Models: `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash` |

### Package Manager
- **npm** (se usa `package-lock.json`, no yarn ni pnpm)

### Scripts
```bash
npm run dev    # Servidor de desarrollo (next dev)
npm run build  # Build de producción (next build)
npm run start  # Arrancar producción (next start)
npm run lint   # ESLint
```

---

## 2. Arquitectura General

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (LeagueDataProvider + Navbar + StatsChat + Footer)
│   ├── page.tsx            # Home — Server Component, `force-dynamic`
│   ├── globals.css         # Design system completo (~1131 líneas)
│   │
│   ├── admin/              # Panel de administración (protegido por contraseña)
│   │   ├── layout.tsx      # Client — auth gate (sessionStorage)
│   │   ├── page.tsx        # Gestión de equipos (~25KB)
│   │   ├── jugadores/      # CRUD de jugadores
│   │   ├── calendario/     # Gestión del calendario
│   │   └── importar/       # Importación de actas FBM (.xlsx)
│   │
│   ├── clasificacion/      # Tabla de clasificación
│   ├── calendario/         # Vista del calendario de partidos
│   ├── equipos/            # Lista + detalle de equipos
│   │   └── [teamId]/       # Detalle equipo (Server + Client)
│   ├── estadisticas/       # Hub de estadísticas
│   │   ├── EstadisticasClient.tsx  # Cliente principal (~40KB, la vista más grande)
│   │   ├── AdvancedStatsTab.tsx    # Estadísticas avanzadas de jugadores
│   │   ├── TeamAdvancedStatsTab.tsx # Estadísticas avanzadas de equipos
│   │   ├── avanzadas/[statKey]/    # Rutas dinámicas por stat avanzada
│   │   ├── equipos/[statKey]/      # Rutas dinámicas stats equipo
│   │   └── jugadores/[statKey]/    # Rutas dinámicas stats jugador
│   ├── jugadores/[playerId]/       # Perfil de jugador
│   ├── partidos/[matchId]/         # Detalle de partido
│   │
│   └── api/                # API Routes
│       ├── data/route.ts   # GET/PUT — CRUD Supabase (data_store)
│       ├── chat/route.ts   # POST — AI chat (Gemini API)
│       └── admin/auth/route.ts  # POST — autenticación admin
│
├── components/             # Componentes reutilizables
│   ├── Navbar.tsx          # Desktop navbar + Mobile bottom tab bar
│   ├── MatchCard.tsx       # Tarjeta de partido
│   ├── StandingsTable.tsx  # Tabla de clasificación
│   ├── StandingsChart.tsx  # Gráfico evolución clasificación
│   ├── TopScorersChart.tsx # Gráfico máximos anotadores
│   ├── StatsFilterBar.tsx  # Barra de filtros para estadísticas
│   ├── PlayerGameLog.tsx   # Game log por jugador
│   ├── TeamLogo.tsx        # Logo de equipo con fallback
│   ├── CaptureButton.tsx   # Screenshot a imagen (html-to-image)
│   └── StatsChat.tsx       # Chat flotante con AIndrés Montes (Gemini)
│
└── lib/                    # Lógica de negocio y utilidades
    ├── types.ts            # Interfaces TypeScript: Team, Player, Match, PlayerStats, StandingRow, ParsedActa, PlayerAverages
    ├── data.ts             # Datos por defecto (equipos hardcoded) + helpers síncronos
    ├── supabase.ts         # Cliente Supabase singleton
    ├── serverData.ts       # Lectura server-side desde Supabase (para Server Components)
    ├── DataContext.tsx      # React Context (LeagueDataProvider) — state + persistencia cliente
    ├── initData.ts         # Inicialización de archivos JSON locales (legacy, pre-Supabase)
    ├── parseActa.ts        # Parser de actas FBM en formato Excel (.xlsx)
    ├── importEngine.ts     # Motor de importación: orquesta parseo → matching → stats → standings
    ├── advancedStats.ts    # Módulo sabermetrics: TS%, eFG%, USG%, GameScore, Pace, ORtg, DRtg, etc.
    └── serializeContext.ts # Serializa TODOS los datos a CSV compacto para contexto del chat AI
```

---

## 3. Modelo de Datos

### Supabase — Tabla `data_store`
Arquitectura de **key-value store** sobre PostgreSQL. Una sola tabla con:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `key` | `text` (PK) | Identificador del dataset |
| `value` | `jsonb` | Los datos como JSON |
| `updated_at` | `timestamptz` | Última actualización |

**Keys válidas:**
- `teams` → `Team[]`
- `players` → `Player[]`
- `matches` → `Match[]`
- `playerStats` → `PlayerStats[]`
- `standings` → `StandingRow[]`
- `importHistory` → `ImportedActaRecord[]`
- `adminConfig` → `{ adminPassword: string }`

### Interfaces principales (ver `src/lib/types.ts`)

- **Team**: `id, name, shortName, primaryColor, secondaryColor, logoUrl?, logoStyle?`
- **Player**: `id, teamId, name, number, position[], height?, birthDate?, photoUrl?, isActive`
- **Match**: `id, matchday, matchDate, homeTeamId, awayTeamId, homeScore, awayScore, matchType ('regular'|'copa'|'playoff'), venue?, isPlayed`
- **PlayerStats**: Estadísticas completas por partido (PTS, 2P, 3P, TL, rebotes, asistencias, recuperaciones, pérdidas, tapones, faltas, eficiencia FBM, +/-)
- **StandingRow**: `teamId, position, played, wins, losses, pointsFor, pointsAgainst, pointsDiff, streak, leaguePoints`
- **ParsedActa** / **ParsedPlayerLine**: Resultado del parseo de actas Excel FBM

### IDs Conventions
- Teams: `team-01` a `team-10`
- Players: `p-auto-{timestamp}-{random4chars}` (auto-generados al importar)
- Matches: `m-01`, `m-02`... (auto-incrementales)
- PlayerStats: `ps-001`, `ps-002`... (auto-incrementales)

---

## 4. Equipos de la Liga (10 equipos)

| ID | Nombre | Short | Color Primario |
|----|--------|-------|---------------|
| team-01 | **La Paloma BC** | PAL | #1D1D1F (negro) |
| team-02 | Labouré Spinners | LAB | #E67E22 (naranja) |
| team-03 | Trigolution Magikikos | TRI | #8E8E93 (gris) |
| team-04 | Siena Suns | SIE | #AF52DE (morado) |
| team-05 | Salterio Lauders | SAL | #34C759 (verde) |
| team-06 | Betsaida Boanerges | BET | #FF9500 (naranja) |
| team-07 | Snow Knights | SNO | #1B3A5C (azul oscuro) |
| team-08 | Begoña Bulls | BEG | #FF3B30 (rojo) |
| team-09 | The Valva Cherubs | VAL | #5AC8FA (azul claro) |
| team-10 | Los Ángeles Prayers | LAP | #E8A317 (dorado) |

Solo `team-01` (La Paloma BC) tiene logo en `/public/teams/pal.png`.

---

## 5. Flujo de Datos

### Server Components (Home page, etc.)
```
Supabase → serverData.ts (readFromSupabase) → Server Component props
```
- El home page usa `export const dynamic = 'force-dynamic'` para evitar cache.

### Client Components (Admin, Estadísticas, etc.)
```
mount → DataContext.loadFromDisk() → fetch GET /api/data → Supabase → state
mutate → DataContext.update*() → setState + fetch PUT /api/data → Supabase upsert
```
- `LeagueDataProvider` en el root layout wrappea toda la app.
- Tiene migración automática de `localStorage` a Supabase (legacy path).

### Importación de Actas FBM
```
.xlsx file → parseActaExcel() → ParsedActa
ParsedActa → executeImport() → {
  match, homeStats, awayStats, newPlayers,
  updatedMatches, updatedPlayerStats, updatedPlayers,
  updatedStandings, importRecord, forfeitInfo
}
```
- Detecta **incomparecencias** (forfeit) si un equipo tiene < 5 jugadores → score 20-0.
- **Fuzzy matching** de equipos por nombre.
- **Auto-creación de jugadores** por dorsal + equipo si no existen.
- **Recálculo completo de standings** tras cada importación.
- Tiebreaker: J1-J9 = head-to-head; J10+ (playoffs) = diferencia de puntos.

---

## 6. AI Chat — AIndrés Montes

Chatbot integrado que simula al legendario narrador **Andrés Montes** (Canal+/NBA).

- **API**: Gemini (Google) con fallback multi-modelo (`2.5-flash` → `2.5-flash-lite` → `2.0-flash`)
- **Prompt**: System prompt extenso que define personalidad, estilo, expresiones míticas, y reglas estrictas de datos
- **Contexto**: `serializeContext.ts` serializa TODA la liga (clasificación, plantillas, resultados, totales, medias, avanzadas, rankings) a formato CSV compacto
- **Cache**: In-memory de 5 min para respuestas sin historial
- **Thinking desactivado** para modelos 2.5 (`thinkingBudget: 0`) para ahorrar tokens
- **UI**: Widget flotante (bottom-right) con avatar personalizado (`/public/aindres-montes.png`)
- Regla clave: **CERO datos inventados** — solo datos del CSV

---

## 7. Autenticación Admin

- **Mecanismo**: Contraseña simple, verificada server-side via `/api/admin/auth`
- **Almacenamiento**: Contraseña en Supabase (`adminConfig.adminPassword`), fallback a `ADMIN_PASSWORD` env var
- **Sesión**: `sessionStorage` (key: `parish-admin-auth`) — se pierde al cerrar pestaña
- **Funcionalidad**: Login + cambio de contraseña desde el panel

---

## 8. Variables de Entorno (`.env.local`)

```
GEMINI_API_KEY=...          # API key de Google Gemini para el chatbot
ADMIN_PASSWORD=...          # Contraseña admin (fallback si no hay en Supabase)
NEXT_PUBLIC_SUPABASE_URL=...        # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Anon key de Supabase (pública)
```

> ⚠️ **Seguridad**: La Supabase anon key es pública por diseño (Row Level Security debería estar configurado). La GEMINI_API_KEY es privada (server-only).

---

## 9. Estadísticas Avanzadas

El módulo `advancedStats.ts` implementa sabermetrics de baloncesto:

### Jugador
- **TS%** (True Shooting) — eficiencia total de tiro
- **eFG%** (Effective FG) — ajusta por valor extra de triples
- **USG%** (Usage Rate) — % de posesiones usadas
- **Game Score** (Hollinger) — productividad en un número
- **AST/TO** — ratio asistencias/pérdidas
- **TOV%** — tasa de pérdidas
- **Floor%** — % de posesiones que terminan en anotación
- **PPP** — puntos por posesión individual
- **ORB%/DRB%/TRB%** — porcentajes de rebote
- **STL%/BLK%** — porcentajes defensivos

### Equipo
- **ORtg/DRtg/Net** — ratings ofensivo, defensivo y neto
- **Pace** — posesiones por 48 minutos
- **FT Rate / 3PA Rate** — tasa de tiros libres y triples
- **AST Ratio / TOV Rate** — ratios de equipo
- **ORB%/DRB%/STL%/BLK%** — métricas defensivas

---

## 10. Scripts de Ejecución (`executions/`)

### `migrate-to-supabase.js`
- **Propósito**: Migración one-time de JSON local → Supabase
- **Ejecución**: `node executions/migrate-to-supabase.js`
- Sube todos los archivos de `data/` a la tabla `data_store`

### `reset-season.js`
- **Propósito**: Reset para nueva temporada
- **Ejecución**: `node executions/reset-season.js`
- Vacía: matches, playerStats, standings, importHistory
- Conserva: teams (intactos) + players de La Paloma BC (`team-01`)
- Elimina: jugadores de todos los demás equipos

### `create-calendar-2026-27.js`
- **Propósito**: Creación del calendario oficial de competición FBM 2026/27 (45 partidos, 9 jornadas)
- **Ejecución**: `node executions/create-calendar-2026-27.js`
- Carga los 45 partidos sin jugar (`isPlayed: false`, scores `null`, fechas vacías pendientes de fijación FBM) e inicializa la tabla de `standings` en 0 PJ.
- Sigue la directiva `directives/calendar-import.md`.

### `repair-m02.js`
- **Propósito**: Reparación determinista de las estadísticas de jugadores para m-02 (TRI vs BET) tras corregir la lógica de matching de actas.
- **Ejecución**: `node executions/repair-m02.js`

---

## 11. Design System (CSS)

Diseño **Apple-inspired** — limpio, minimalista, con profundidad sutil.

### Tokens principales
- **Colores**: `--color-primary: #007AFF` (Apple blue), `--color-accent: #FF9500`, `--color-success: #34C759`, `--color-danger: #FF3B30`
- **Backgrounds**: `--color-bg-primary: #FFFFFF`, `--color-bg-secondary: #F5F5F7`
- **Tipografía**: Display = Outfit, Body = Inter
- **Radios**: `--radius-sm: 8px` → `--radius-full: 9999px`
- **Sombras**: Subtle depth (`--shadow-xs` → `--shadow-xl`)
- **Transiciones**: Apple-buttery (`cubic-bezier(0.25, 0.1, 0.25, 1)`)
- **Layout**: `--max-width: 1200px`, `--nav-height: 52px`

### Patrones CSS
- `.page-container` — wrapper principal con max-width
- `.card` — tarjeta con borde, sombra y hover
- `.stat-card` — variante de card para métricas
- `.section` / `.section-header` — secciones con título + link
- `.grid-2` / `.grid-4` — grids responsivos
- `.animate-fade-in-up` + `.delay-1` a `.delay-5` — animaciones escalonadas
- `.navbar` + `.mobile-tab-bar` — navegación responsive (desktop top bar + mobile bottom tabs)
- `.hero` — sección hero de la home

### Navegación
- **Desktop**: Navbar fijo top con backdrop-filter blur
- **Mobile**: Bottom tab bar estilo iOS (5 tabs: Inicio, Clasificación, Equipos, Calendario, Estadísticas)
- Admin tiene su propia tab navigation interna (Equipos, Jugadores, Calendario, Importar Actas)

---

## 12. PWA

Configuración básica de PWA en `public/manifest.json`:
- `display: "standalone"`
- Icons: 192px y 512px
- `theme_color: "#1D1D1F"` (dark)
- `background_color: "#F5F5F7"` (light gray)

---

## 13. Patrones de Código

### Server vs Client Components
- Páginas principales con datos dinámicos: **Client Components** (`'use client'`) que usan `useLeagueData()` del `DataContext`. Esto permite que el cambio de temporada (multi-season) funcione correctamente.
- Páginas con rutas dinámicas (`[teamId]`, `[playerId]`, `[matchId]`): Server Component shell (para metadata/SEO) → Client Component para renderizado de datos.
- Metadata SEO: Se define en `layout.tsx` (Server Component) cuando la `page.tsx` es Client Component.
- **Regla**: No usar `getXxxFromDisk()` de `serverData.ts` para datos que deban respetar la temporada seleccionada. Usar siempre `useLeagueData()`.

### Convención de nombres
- Archivos de componente: `PascalCase.tsx`
- Archivos de lib: `camelCase.ts`
- CSS: `globals.css` centralizado (no CSS modules excepto `Navbar.module.css` que es mínimo)
- Rutas en español: `/clasificacion`, `/equipos`, `/calendario`, `/estadisticas`, `/jugadores`, `/partidos`, `/admin`

### Idioma
- **UI y rutas**: Todo en español
- **Código** (variables, funciones, comentarios de doc): Inglés
- **Tipos/Interfaces**: Inglés
- **Datos del dominio** (nombres de equipo, posiciones): Español

### Imports
- Path alias: `@/*` → `./src/*`
- Imports absolutos preferidos sobre relativos

---

## 14. Datos Locales (Legacy + Backup)

El directorio `data/` contiene copias locales JSON (gitignored):
- `teams.json`, `players.json`, `matches.json`, `playerStats.json`, `standings.json`
- `importHistory.json`, `admin-config.json`

Estos archivos ya NO son la fuente primaria (Supabase lo es), pero `initData.ts` los puede re-crear y el script de migración los lee.

---

## 15. Archivos Notables

| Archivo | Tamaño | Nota |
|---------|--------|------|
| `src/app/admin/importar/page.tsx` | 44KB | La vista de importación de actas, la más compleja |
| `src/app/estadisticas/EstadisticasClient.tsx` | 40KB | Hub de estadísticas, muy denso |
| `src/app/admin/page.tsx` | 25KB | Gestión de equipos |
| `src/app/admin/jugadores/page.tsx` | 25KB | CRUD de jugadores |
| `src/app/admin/calendario/page.tsx` | 25KB | Gestión del calendario |
| `src/app/jugadores/[playerId]/PlayerPageClient.tsx` | 28KB | Perfil detallado de jugador |
| `src/lib/importEngine.ts` | 16KB | Motor de importación |
| `src/lib/advancedStats.ts` | 15KB | Sabermetrics |
| `src/lib/serializeContext.ts` | 10KB | Serialización para AI context |
| `src/app/globals.css` | 25KB | Design system completo |

---

## 16. Cosas Importantes a Recordar

1. **No hay testing** — No hay tests unitarios ni e2e configurados.
2. **No hay dark mode** — Solo tema light.
3. **Sin i18n** — Todo hardcoded en español (rutas y UI).
4. **Sin auth robusta** — La autenticación admin es una simple contraseña, no hay tokens JWT ni middleware de Next.js.
5. **Supabase con RLS habilitado** — `data_store` tiene Row-Level Security. Anon key solo puede SELECT (excepto `adminConfig`). Escritura requiere `service_role` key (server-only). Ver `supabase.ts` para los dos clientes.
6. **Un solo CSS global** — No se usa Tailwind, ni CSS modules generalizados, ni CSS-in-JS. Todo va en `globals.css`.
7. **`data.ts` tiene equipos hardcodeados** — Los 10 equipos están tanto en `data.ts` como en Supabase, pero el source of truth es Supabase.
8. **El chat AI envía TODOS los datos** — `serializeContext.ts` serializa toda la liga como CSV y lo manda en cada petición al LLM. Puede ser pesado.
9. **`initData.ts`** es código legacy del era pre-Supabase (lectura/escritura de archivos JSON locales). No eliminar, podría ser útil como fallback.
10. **Next.js 16** — Versión muy reciente, consulta siempre `node_modules/next/dist/docs/` antes de asumir APIs.
11. **Multi-temporada** — El sistema soporta múltiples temporadas. La activa usa keys sin prefijo en Supabase, las archivadas usan prefijo `seasonId:key` (ej: `2025-26:matches`). Ver sección 17.

---

## 17. Sistema Multi-Temporada (Archivo Histórico)

### Arquitectura
- **Temporada activa**: datos en keys sin prefijo (`teams`, `matches`, etc.) — lectura/escritura normal
- **Temporadas archivadas**: datos en keys con prefijo (`2025-26:teams`, `2025-26:matches`) — solo lectura
- **Registro de temporadas**: key `seasons` en Supabase con metadatos `Season[]`

### Componentes clave
- `Season` interface en `types.ts`: `id`, `label`, `isActive`, `archivedAt?`
- `DataContext.tsx`: estado `currentSeason`, `isArchive`, `setCurrentSeasonId()` para cambiar temporada
- `Navbar.tsx`: selector de temporada con dropdown, badge LIVE, y banner de archivo
- `SeasonFooter.tsx`: footer dinámico con label de temporada
- `SeasonLabels.tsx`: componentes cliente para textos dinámicos en Server Components
- `api/seasons/route.ts`: endpoint GET para listar temporadas
- `api/data/route.ts`: soporta `?season=2025-26` en GET para leer datos archivados
- Admin layout: modo archivo deshabilitado (overlay + notice) cuando `isArchive === true`

### Scripts
- `executions/archive-season.js`: archiva la temporada actual copiando datos con prefijo, crea registro en `seasons`, y vacía datos activos
  - Uso: `node executions/archive-season.js 2025-26`

### Flujo
1. Al final de una temporada → ejecutar `archive-season.js`
2. Los datos se copian con prefijo en Supabase
3. Keys activas se vacían (excepto `teams` y `players`)
4. La web muestra la nueva temporada vacía con empty state
5. El usuario puede cambiar entre temporadas con el selector en la Navbar

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-09-17 | **Multi-temporada**: Sistema de archivo histórico implementado. Selector de temporada en Navbar, protección admin en modo archivo, API con soporte `?season=`, script de archivado. |
| 2026-09-17 | **Calendario 2026/27**: Creados los 45 partidos de las 9 jornadas de la Liga Regular FBM en Supabase (todos pendientes de jugar, listos para recibir actas). Inicializada la clasificación. Mejorada la selección de jornada activa en `/calendario` para priorizar la jornada pendiente más próxima en lugar de saltar a J9. Directiva en `directives/calendar-import.md`. |
| 2026-09-17 | **Fix Matching Jugadores en Actas**: Corregido bug en `importEngine.ts` que priorizaba el dorsal sobre el nombre al importar actas, lo que causaba falsos positivos cuando jugadores cambiaban de dorsal entre temporadas (ej. Gabriel Rosas duplicado, Pedro Sandín y Juan Ruiz Cano no creados). Ahora prioriza coincidencia exacta y difusa por nombre y solo usa el dorsal si hay compatibilidad de nombre. Reparados los datos de `m-02` en Supabase con `repair-m02.js`. |
| 2026-09-20 | **Fix Multi-Temporada: Datos archivados no se mostraban**. Convertidas las páginas Home (`/`), Clasificación (`/clasificacion`) y Equipos (`/equipos`) de Server Components a Client Components para que lean datos del `DataContext` (que respeta la temporada seleccionada) en vez de leer directamente de Supabase sin prefijo. Añadidos `layout.tsx` para SEO metadata en `/clasificacion` y `/equipos`. Eliminado `ClasificacionClient` como wrapper intermedio innecesario — ahora lee standings del context. |
| 2026-09-20 | **Vista Calendario Mensual** en `/calendario`. Toggle Jornadas/Calendario. Grid mensual con navegación, pills de partidos por día (coloreados: verde=jugado, naranja=próximo), indicador de hoy, panel detalle al clicar día. Pills muestran etiqueta de jornada (J1, COP, PO). Pills jugados son clicables → `/partidos/[matchId]`. Responsive para mobile. |
| 2026-09-20 | **Fix fechas de partidos**: Corregidas 4 fechas de partidos jugados (m-01, m-02 → 12/09; m-04, m-06 → 19/09) y 12 fechas de partidos futuros (ene-mar 2026 → 2027). Añadido campo 📅 editable en la importación de actas para confirmar/cambiar la fecha del partido antes de importar. `executeImport` y `createMatch` ahora aceptan `matchDate` opcional (prioridad: explícita > calendario > hoy). |
| 2026-09-20 | **Botón Atrás en Acta de Partido**: Añadido botón interactivo `← Atrás` en la vista de detalle de partido (`/partidos/[matchId]`) para volver de forma inmediata a la página anterior mediante `router.back()` (con fallback a `/calendario`). Extraído `BoxScoreTable` como componente independiente para cumplir las reglas de hooks de React 19/Next 16. |
| 2026-09-21 | **Hora del Partido en Calendario y Configuración**: Añadido soporte para `matchTime?: string` en el modelo `Match`. Ahora se puede editar la hora (y fecha) en `/admin/calendario` tanto para partidos pendientes como jugados, así como en `/admin/importar`. En el calendario público (`/calendario`), la hora se muestra en las píldoras del calendario mensual (`J1 18:00 PAL vs SIE`), en las tarjetas de partido por jornada (`MatchCard`), y en el encabezado del acta (`/partidos/[matchId]`). Partidos del mismo día se ordenan cronológicamente por hora. |
| 2026-09-21 | **Filtro por Equipos en Calendario**: Implementada barra de filtros interactiva por equipo en `/calendario`. Permite filtrar por uno o varios equipos de forma combinada (multiselección mediante chips táctiles con logos y colores de equipo, o botón "Todos los equipos"). El filtro aplica tanto a la vista por jornadas (mostrando solo los partidos de los equipos filtrados y empty state guiado si no juegan en esa jornada) como a la vista de calendario mensual (mostrando solo las píldoras y días de juego de esos equipos). Compatible con parámetro URL `?equipo=team-id`. |
| 2026-09-23 | **Seguridad: RLS en Supabase**. Habilitado Row-Level Security en `data_store`. Anon key: solo SELECT (excepto `adminConfig`). Escritura: solo `service_role`. Añadida `SUPABASE_SERVICE_ROLE_KEY` a `.env.local` (server-only). Creado `supabaseAdmin` client en `supabase.ts`. Actualizados `/api/data` (PUT → supabaseAdmin), `/api/admin/auth` (todo → supabaseAdmin). Actualizados 5 scripts de `executions/` para usar service_role via dotenv. Eliminadas anon keys hardcodeadas de scripts. |
| 2026-09-23 | **Logos de Equipos en Todos los Menús**: Propagados los logos de equipos a todas las secciones de la app. Añadido `logoUrl` a las definiciones estáticas en `src/lib/data.ts` y `data/teams.json` para los 9 equipos con logo. Conectados `StandingsTable` y `MatchCard` a `useLeagueData()` para que resuelvan equipos de forma reactiva con fallback a `getTeam()`. Añadido soporte para mostrar el logo del rival en el game log de jugadores (`PlayerGameLog`), logo del líder en la tarjeta de resumen de Inicio (`/`), y en el modal de detalle del calendario mensual (`/calendario`). |


