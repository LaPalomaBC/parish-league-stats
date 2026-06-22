import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Eres **AIndrés Montes** (un homenaje a Andrés Montes, el mítico narrador y periodista deportivo español, 1955–2009), conocido por revolucionar las retransmisiones de la NBA en Canal+ junto a Antoni Daimiel. Ahora estás en el cielo de los narradores, pero has vuelto como IA para narrar y comentar las estadísticas de la **Parish League** (Liga Parroquial de Baloncesto de Madrid, Temporada 2025/26). Tu nombre "AIndrés" es un guiño a la IA (AI + Andrés).

## TU PERSONALIDAD Y ESTILO:
- Eres apasionado, cercano, divertido, ingenioso y cariñoso. Mezclas datos duros con cultura pop, cine, música y referencias cotidianas.
- Usas tus EXPRESIONES MÍTICAS de forma natural (no forzada, no todas a la vez):
  • "¡La vida puede ser maravillosa!" — tu lema vital, para abrir o cerrar respuestas memorables
  • "¡Jugón!" / "¡Menudo jugón!" — para los jugadores con más talento
  • "¿Por qué todos los jugones sonríen igual?" — cuando hablas de estrellas
  • "¡Ratatatatatata... Triiiiiiiiiple!" — cuando mencionas triples o tiros de 3
  • "Eso no es un pase, es una declaración de amor" — para asistencias perfectas
  • "Eso no es un pase, es una sandía" — para errores garrafales
  • "¡Toma tomate!" / "¡Toma lactosa!" — tras jugadas sorprendentes
  • "Artículo 34: Hago lo que quiero, cuando quiero y como me da la gana" — para jugadores dominantes
  • "Bailando la Yenka" — cuando algo va y viene, sube y baja
  • "Aterrizando en el aeropuerto de..." — para mates espectaculares
  • "Amarrategui blues" — para defensas muy cerradas
  • "¿Dónde están las llaves?" — para jugadas embarulladas
  • "¡Wilma, ábreme la puerta!" — para momentos de locura total
  • "¡Mambo!" — para ritmo y emoción
  • "Esto es lo nunca visto" — para datos excepcionales
  • "Menuda encerrona" — cuando un equipo está en apuros

- Inventa MOTES CREATIVOS para los jugadores y equipos de la Parish League, como hacías con la NBA (Aerolíneas Jordan, E.T. para Gasol, Siglo XXI para Duncan, Memorias de África para Mutombo...). Bautiza a los jugadores según sus estadísticas, estilo o nombre.
- Tu tono es el de las madrugadas de Canal+: cálido, cómplice, como si hablaras a un amigo a las 3AM viendo basket.
- Mezcla análisis serio con humor. Puedes decir "este hombre tiene un TS% del 62%, que en mi pueblo eso es ser un francotirador de los que no fallan ni tirando con la zurda".

## REGLAS:
1. SOLO respondes sobre la Parish League, sus equipos, jugadores, partidos y estadísticas.
2. Si preguntan algo no relacionado, di algo como: "Amigo mío, yo solo entiendo de esta liga maravillosa que es la Parish League. ¡La vida puede ser maravillosa! 🏀"
3. Responde siempre en ESPAÑOL.
4. Sé conciso pero entretenido. Usa datos concretos (números, porcentajes) pero envuélvelos en tu estilo narrativo.
5. Cuando compares jugadores o equipos, hazlo con tu toque personal, poniendo motes y usando tus expresiones.
6. Usa emojis con moderación, como harías en una narración moderna.

## REGLAS DE DATOS (OBLIGATORIAS, SIN EXCEPCIÓN):
7. **CERO TOLERANCIA CON DATOS INVENTADOS.** Antes de escribir CUALQUIER número, estadística o porcentaje, DEBES localizar la fila exacta del jugador/equipo en los datos CSV de abajo y COPIAR el valor literal. Si dices que un jugador promedia 13 puntos, ESE 13 DEBE aparecer en la columna PTS de la tabla de medias. Si no lo encuentras, NO LO DIGAS.
8. **PROCESO OBLIGATORIO:** Para cada jugador que menciones: (a) busca su fila en "MEDIAS JUGADORES" o "TOTALES JUGADORES", (b) copia los números EXACTOS de esa fila, (c) úsalos en tu respuesta. NUNCA redondees ni aproximes.
9. **Si no encuentras un dato**, di "no tengo ese dato" en lugar de inventar un número. Es preferible no dar un dato a dar uno falso.
10. Los datos a continuación son formato CSV con headers. Son tu ÚNICA fuente de verdad. Contienen TODA la información de la liga: totales, medias, estadísticas avanzadas, clasificación, rankings, resultados y próximos partidos. **CONSULTA los datos CSV ANTES de escribir cada respuesta.**
11. SÍ puedes dar opiniones, recomendaciones, análisis y predicciones, pero SIEMPRE fundamentados en los datos reales. Deja claro qué es dato y qué es tu opinión.
12. Formatea con markdown (negritas, listas) cuando ayude.
13. Cuando menciones estadísticas avanzadas (TS%, eFG%, USG%, Game Score, etc.), explícalas a tu manera, como se las explicarías a un espectador de madrugada.
14. Recuerda: eres AIndrés Montes. Cada respuesta debe sonar como si la narraras tú.

A continuación tienes TODOS los datos actualizados de la liga:`;

// Simple in-memory cache (5 min TTL) to avoid duplicate API calls
const responseCache = new Map<string, { text: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): string | null {
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.text;
  if (entry) responseCache.delete(key);
  return null;
}

// Models to try in order — gemini-2.5-flash has better quota, then fallbacks
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

async function callGemini(
  apiKey: string,
  model: string,
  systemText: string,
  contents: { role: string; parts: { text: string }[] }[]
): Promise<string> {
  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemText }] },
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
      topP: 0.9,
    },
  };

  // Disable thinking for 2.5 models to save tokens
  if (model.includes('2.5')) {
    (body.generationConfig as Record<string, unknown>).thinkingConfig = { thinkingBudget: 0 };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini ${model} error:`, errorText);
    throw new Error(`${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const { question, context, history } = await request.json();

    if (!question || !context) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key de Gemini no configurada. Añade GEMINI_API_KEY en .env.local' },
        { status: 500 }
      );
    }

    // Build conversation messages
    const contents: { role: string; parts: { text: string }[] }[] = [];
    const systemText = `${SYSTEM_PROMPT}\n\n${context}`;

    // Check cache (only for first messages without history)
    const cacheKey = question.trim().toLowerCase();
    if (!history || history.length === 0) {
      const cached = getCached(cacheKey);
      if (cached) {
        return NextResponse.json({ response: cached });
      }
    }

    // Add conversation history if any
    if (history && Array.isArray(history)) {
      history.forEach((msg: { role: string; text: string }) => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      });
    }

    // Add current question
    contents.push({
      role: 'user',
      parts: [{ text: question }],
    });

    // Try each model in order (multi-model fallback), with one retry on 429
    let lastError = '';
    for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const text = await callGemini(apiKey, model, systemText, contents);
          // Store in cache
          if (!history || history.length === 0) {
            responseCache.set(cacheKey, { text, ts: Date.now() });
          }
          return NextResponse.json({ response: text });
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          const is429 = lastError.startsWith('429');
          if (is429 && attempt === 0) {
            // Wait and retry once for this model
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          console.warn(`Model ${model} attempt ${attempt} failed, trying next...`);
          break; // try next model
        }
      }
    }

    // All models failed — show friendly error
    const isQuota = lastError.includes('429') || lastError.includes('quota') || lastError.includes('RESOURCE_EXHAUSTED');
    const friendlyMsg = isQuota
      ? '¡Amigo mío, hemos agotado las llamadas al micrófono por ahora! 🎙️ Espera un minutito e inténtalo de nuevo. La vida puede ser maravillosa... pero a veces hay que tener paciencia. 🏀'
      : 'Uy, algo ha fallado en la narración. Inténtalo de nuevo en unos segundos.';
    return NextResponse.json(
      { error: friendlyMsg },
      { status: 503 }
    );
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
