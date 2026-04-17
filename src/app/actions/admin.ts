'use server';

import { sendEmail } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function adminUpdateUser(
  userId: string, 
  data: { nome: string; conta?: string; email: string }
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
      updateProps.email = `${data.conta.toLowerCase()}@proconsig.system`;
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
    if (data.conta) {
      dbUpdate.conta = data.conta.toLowerCase();
    }

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
        html: `<p>Olá ${user.nome},</p><p>Sua conta (<strong>${user.conta}</strong>) foi aprovada pelo administrador.</p><p>Você já pode acessar o painel gerenciador usando suas credenciais.</p>`
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
