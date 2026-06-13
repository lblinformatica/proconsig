'use server';

import { sendEmail } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function adminUpdateUser(
  userId: string, 
  data: { nome: string; conta?: string; email: string; nivel?: string; grupos_permitidos?: string[] }
) {
  try {
    // 1. Find the Supabase Auth ID for that public user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('usuarios')
      .select('supabase_user_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return { error: 'Usuário não encontrado no banco de dados.' };
    }

    // Verify duplicate conta if provided
    if (data.conta) {
      const { data: existingConta } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('conta', data.conta.toLowerCase())
        .single();

      if (existingConta && existingConta.id !== userId) {
        return { error: 'Já existe uma conta com este nome de usuário.' };
      }
    }

    // 2. Update Auth User (this changes the email they use to login)
    let updateProps: any = { email_confirm: true };
    if (data.conta) {
      updateProps.email = `${data.conta.toLowerCase().replace(/\s+/g, '')}@proconsig.system`;
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.supabase_user_id,
      updateProps
    );

    if (authError) {
      return { error: 'Erro ao atualizar login (Auth) do usuário: ' + authError.message };
    }

    // 3. Update Public Profile
    let dbUpdate: any = { nome: data.nome, email: data.email };
    if (data.conta) dbUpdate.conta = data.conta.toLowerCase();
    if (data.nivel) dbUpdate.nivel = data.nivel;
    if (data.grupos_permitidos) dbUpdate.grupos_permitidos = data.grupos_permitidos;

    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .update(dbUpdate)
      .eq('id', userId);

    if (dbError) {
      return { error: 'Erro ao atualizar o perfil público: ' + dbError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: 'Erro interno: ' + err.message };
  }
}

export async function adminChangeUserStatus(
  userId: string,
  actionType: 'approve_op' | 'approve_admin' | 'deactivate' | 'reactivate' | 'reject' | 'toggle_level'
) {
  try {
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return { error: 'Usuário não encontrado.' };
    }

    let updatePayload: any = {};
    if (actionType === 'approve_op') updatePayload = { status: 'ativo', nivel: 'operacional' };
    else if (actionType === 'approve_admin') updatePayload = { status: 'ativo', nivel: 'admin' };
    else if (actionType === 'deactivate') updatePayload = { status: 'inativo' };
    else if (actionType === 'reactivate') updatePayload = { status: 'ativo' };
    else if (actionType === 'reject') updatePayload = { status: 'rejeitado' };
    else if (actionType === 'toggle_level') updatePayload = { nivel: user.nivel === 'admin' ? 'operacional' : 'admin' };

    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .update(updatePayload)
      .eq('id', userId);

    if (dbError) {
      return { error: 'Falha ao atualizar banco de dados: ' + dbError.message };
    }

    // Send email on approval
    if ((actionType === 'approve_op' || actionType === 'approve_admin') && user.status === 'pendente') {
      await sendEmail({
        to: user.email,
        subject: 'Sua conta foi aprovada!',
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
              <p style="margin-top: 0; font-size: 16px;">Olá <strong>${user.nome}</strong>,</p>
              <p style="font-size: 15px;">Sua conta no sistema <strong>Central Pagamentos</strong> foi aprovada com sucesso pelo administrador.</p>
              <p style="font-size: 15px;">Você já pode acessar a plataforma utilizando suas credenciais de login.</p>
              
              <!-- Details Card -->
              <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin-top: 0; margin-bottom: 15px; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Credenciais de Acesso</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Nome de Usuário (Conta):</td>
                    <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${user.conta}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">E-mail Cadastrado:</td>
                    <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${user.email}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin: 25px 0;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px;">Acessar Central de Pagamentos</a>
              </div>

              <p style="font-size: 14px; color: #64748b; margin-bottom: 0;">Se precisar de ajuda ou tiver alguma dúvida, entre em contato com a equipe de suporte.</p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f1f5f9; padding: 15px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">© 2026 ProConsig - Central Pagamentos. Todos os direitos reservados.</p>
            </div>
          </div>
        `
      }).catch(err => console.error('Error sending approval email:', err));
    }

    return { success: true };
  } catch (err: any) {
    return { error: 'Erro interno: ' + err.message };
  }
}

export async function adminDeleteUser(userId: string) {
  try {
    // 1. Get user profile for auth_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('usuarios')
      .select('supabase_user_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return { error: 'Usuário não encontrado.' };
    }

    // 2. Delete from Public (this might fail if there are constraints)
    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .delete()
      .eq('id', userId);

    if (dbError) {
      if (dbError.code === '23503') {
        return { error: 'Não é possível excluir este usuário pois ele possui históricos vinculados (Borderôs/Clientes). Use a opção "Desativar" em vez de excluir.' };
      }
      return { error: 'Erro ao remover do banco: ' + dbError.message };
    }

    // 3. Delete from Auth (optional but recommended for complete cleanup)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      profile.supabase_user_id
    );

    if (authError) {
      // We don't return error here because the DB record is already gone,
      // but we log it. In some cases user might not be in Auth anymore.
      console.warn('User deleted from DB but Auth deletion failed:', authError.message);
    }

    return { success: true };
  } catch (err: any) {
    return { error: 'Erro crítico na exclusão: ' + err.message };
  }
}
