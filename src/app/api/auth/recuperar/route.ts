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

    const pseudoEmail = `${profile.conta.toLowerCase().replace(/\s+/g, '')}@proconsig.system`;

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
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header Banner -->
          <div style="background-color: #4f46e5; padding: 25px 20px; text-align: center;">
            <table style="margin: 0 auto; border-collapse: collapse; border: none;">
              <tr>
                <td style="padding-right: 12px; vertical-align: middle; border: none;">
                  <img src="cid:branding_logo" alt="Logo" width="40" height="40" style="border-radius: 8px; display: block; object-fit: cover; border: none;" />
                </td>
                <td style="text-align: left; vertical-align: middle; border: none;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; line-height: 1.0; letter-spacing: -0.5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; border: none;">Central Pagamentos</h1>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- Content Box -->
          <div style="padding: 30px 25px; background-color: #ffffff; color: #1e293b; line-height: 1.6;">
            <p style="margin-top: 0; font-size: 16px;">Olá <strong>${profile.nome}</strong>,</p>
            <p style="font-size: 15px;">Recebemos uma solicitação para redefinir a sua senha no <strong>Central Pagamentos</strong>.</p>
            <p style="font-size: 15px;">Para criar uma nova senha, clique no botão de redefinição abaixo:</p>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${resetLink}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px;">Redefinir Minha Senha</a>
            </div>

            <!-- Warning Card -->
            <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 15px; margin: 25px 0; font-size: 13px; color: #64748b;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Atenção:</p>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.5;">
                <li>Este link é de uso único e expirará em <strong>30 minutos</strong>.</li>
                <li>Se você não solicitou a redefinição de sua senha, por favor ignore este e-mail. Nenhuma alteração foi feita na sua conta.</li>
              </ul>
            </div>

            <p style="font-size: 14px; color: #64748b; margin-bottom: 0;">Se precisar de assistência adicional, entre em contato com o suporte.</p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f1f5f9; padding: 15px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">© 2026 ProConsig - Central Pagamentos. Todos os direitos reservados.</p>
          </div>
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
