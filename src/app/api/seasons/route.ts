/**
 * API Route: /api/seasons
 *
 * GET → Returns all seasons from Supabase
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Season } from '@/lib/types';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('data_store')
      .select('value')
      .eq('key', 'seasons')
      .single();

    if (error || !data) {
      // No seasons configured yet — return default active season
      const defaultSeasons: Season[] = [
        { id: '2026-27', label: 'Temporada 2026/27', isActive: true },
      ];
      return NextResponse.json(defaultSeasons);
    }

    const seasons: Season[] = Array.isArray(data.value) ? data.value : [];

    // If no seasons exist, return a default
    if (seasons.length === 0) {
      return NextResponse.json([
        { id: '2026-27', label: 'Temporada 2026/27', isActive: true },
      ]);
    }

    return NextResponse.json(seasons);
  } catch (error) {
    console.error('[API /seasons GET] Error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
