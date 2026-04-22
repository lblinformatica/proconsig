import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 });
    }

    // 1. Buscar o perfil para obter a 'conta' (que forma o pseudo-email)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('usuarios')
      .select('conta, nome')
      .eq('email', email.toLowerCase())
      .single();

    if (profileError || !profile) {
      // Retornar sucesso silencioso por segurança, mas o UI do usuário pode decidir o que mostrar
      return NextResponse.json({
        success: true,
        info: 'E-mail não encontrado na base (silencioso)',
        tried: email.toLowerCase()
      });
    }

    const pseudoEmail = `${profile.conta.toLowerCase()}@proconsig.system`;

    // 2. Gerar link de recuperação via Supabase Admin
    // Esse link redirecionará para a URL de site configurada no Supabase (geralmente localhost:3000 ou vercel-url)
    // com um access_token no fragmento da URL (#).
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: pseudoEmail,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/redefinir`,
      }
    });

    if (linkError) {
      console.error('Link Error:', linkError);
      return NextResponse.json({ error: 'Erro ao gerar link de recuperação.' }, { status: 500 });
    }

    const resetLink = linkData.properties.action_link;

    // 3. Enviar o email via Resend para o email REAL
    const emailResult = await sendEmail({
      to: email,
      subject: 'Recuperação de Senha - CentralPagamentos',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Recuperação de Acesso</h2>
          <p>Olá <strong>${profile.nome}</strong>,</p>
          <p>Recebemos uma solicitação para redefinir a sua senha no <strong>CentralPagamentos</strong>.</p>
          <p>Clique no botão abaixo para criar uma nova senha:</p>
          <div style="margin: 30px 0;">
            <a href="${resetLink}" style="padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Redefinir Minha Senha</a>
          </div>
          <p style="color: #64748b; font-size: 0.875rem;">Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 0.75rem;">Este link expirará em 30 minutos.</p>
        </div>
      `
    });

    if (!emailResult.success) {
      console.error('Email send failed:', emailResult.error);
      return NextResponse.json({ error: 'Falha ao enviar e-mail. Verifique o serviço de notificações.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Recovery Error:', err);
    return NextResponse.json({ error: 'Erro interno no servidor de recuperação.' }, { status: 500 });
  }
}
