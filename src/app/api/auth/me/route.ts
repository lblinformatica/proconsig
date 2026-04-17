import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  // Extract token from authorization header if present, or rely on cookie via SSR?
  // Since we are using standard JWT from client:
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
     return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from('usuarios')
    .select('*')
    .eq('supabase_user_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
  }

  return NextResponse.json(profile);
}
