import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;

    const { nome, conta, email, password } = await req.json();

    if (!nome || !conta || !email || !password) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    // Verificar se a conta já existe
    const { data: existingConta } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('conta', conta.toLowerCase())
      .single();

    if (existingConta) {
      return NextResponse.json({ error: 'Já existe uma conta com o nome de usuário informado.' }, { status: 400 });
    }

    const pseudoEmail = `${conta.toLowerCase().replace(/\s+/g, '')}@proconsig.system`;

    // 1. Criar o usuário no Supabase Auth usando o Admin Client (já marca email como confirmado se quisermos)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: pseudoEmail,
      password,
      email_confirm: true, // Auto confima o email para que login funcione depois de aprovado
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Erro ao obter ID do usuário criado' }, { status: 500 });
    }

    // 2. Inserir na tabela usuarios (status = pendente)
    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        supabase_user_id: userId,
        nome,
        conta: conta.toLowerCase(),
        email,
        nivel: 'operacional',
        status: 'pendente'
      });

    if (dbError) {
      // Rollback: try to delete the created auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `Falha na base de dados: ${dbError.message} / ${dbError.details}` }, { status: 500 });
    }

    // 3. Obter admins para notificar
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from('usuarios')
      .select('email')
      .eq('nivel', 'admin')
      .eq('status', 'ativo');

    if (adminsError) {
      console.error('Erro ao buscar administradores para notificação:', adminsError);
    }

    const adminEmails = admins?.map(a => a.email).filter(Boolean) as string[] || [];
    console.log('Administradores ativos encontrados para notificar:', adminEmails);

    // 4. Enviar emails
    // Email para o usuário
    const emailUserRes = await sendEmail({
      to: email,
      subject: 'Cadastro realizado! Aguardando aprovação',
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
            <p style="margin-top: 0; font-size: 16px;">Olá <strong>${nome}</strong>,</p>
            <p style="font-size: 15px;">Seu cadastro foi realizado com sucesso em nosso sistema!</p>
            <p style="font-size: 15px;">Sua conta está atualmente <strong style="color: #4f46e5;">aguardando aprovação</strong> de um administrador do sistema. Você receberá um e-mail de notificação assim que seu acesso for liberado.</p>
            
            <!-- Details Card -->
            <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h3 style="margin-top: 0; margin-bottom: 15px; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Dados do Cadastro</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Nome Completo:</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${nome}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Nome de Usuário (Conta):</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${conta}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">E-mail:</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${email}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 14px; color: #64748b; margin-bottom: 0;">Se você não realizou esta solicitação, entre em contato com o administrador ou desconsidere este e-mail.</p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f1f5f9; padding: 15px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">© 2026 ProConsig - Central Pagamentos. Todos os direitos reservados.</p>
          </div>
        </div>
      `
    });
    console.log(`E-mail de confirmação enviado para o usuário (${email}). Resultado:`, emailUserRes);

    // Email para admins
    if (adminEmails.length > 0) {
      const emailAdminRes = await sendEmail({
        to: adminEmails,
        subject: 'Novo usuário aguardando aprovação',
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
              <p style="margin-top: 0; font-size: 16px;">Olá,</p>
              <p style="font-size: 15px;">Um novo usuário solicitou acesso ao sistema <strong>Central Pagamentos</strong> e está aguardando revisão e aprovação.</p>
              
              <!-- Details Card -->
              <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin-top: 0; margin-bottom: 15px; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Dados do Solicitante</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Nome Completo:</td>
                    <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${nome}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Nome de Usuário (Conta):</td>
                    <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${conta}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">E-mail:</td>
                    <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${email}</td>
                  </tr>
                </table>
              </div>

              <p style="font-size: 15px; margin-bottom: 25px;">Por favor, acesse o painel administrativo para aprovar ou rejeitar o acesso deste usuário.</p>
              
              <div style="text-align: center; margin: 25px 0;">
                <a href="${siteUrl}/usuarios" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px;">Acessar Painel de Usuários</a>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f1f5f9; padding: 15px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">© 2026 ProConsig - Central Pagamentos. Todos os direitos reservados.</p>
            </div>
          </div>
        `
      });
      console.log('E-mail de notificação enviado para os administradores. Resultado:', emailAdminRes);
    } else {
      console.warn('Nenhum e-mail de administrador ativo foi encontrado no banco de dados para notificação.');
    }

    return NextResponse.json({ success: true, message: 'Usuário registrado com sucesso.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
