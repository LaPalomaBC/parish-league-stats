import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function getAdminPassword(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('data_store')
      .select('value')
      .eq('key', 'adminConfig')
      .single();

    if (!error && data?.value?.adminPassword) {
      return data.value.adminPassword;
    }
  } catch { /* fallback to env */ }

  return process.env.ADMIN_PASSWORD || '';
}

export async function POST(request: NextRequest) {
  try {
    const { password, action, newPassword } = await request.json();
    const adminPassword = await getAdminPassword();

    if (!adminPassword) {
      return NextResponse.json(
        { error: 'Contraseña de admin no configurada en el servidor' },
        { status: 500 }
      );
    }

    // Change password action
    if (action === 'change') {
      if (password !== adminPassword) {
        return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 });
      }
      if (!newPassword || newPassword.trim().length < 4) {
        return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' }, { status: 400 });
      }

      const { error } = await supabase
        .from('data_store')
        .upsert({
          key: 'adminConfig',
          value: { adminPassword: newPassword.trim() },
          updated_at: new Date().toISOString(),
        });

      if (error) {
        return NextResponse.json({ error: 'Error al guardar la nueva contraseña' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Contraseña actualizada' });
    }

    // Login action (default)
    if (password === adminPassword) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
