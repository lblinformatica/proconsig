'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import nodemailer from 'nodemailer';

// ── SMTP via Supabase ──────────────────────────────────────────────────────
// Configure as variáveis no .env.local:
//   SMTP_HOST=smtp.supabase.io (ou o host real do seu projeto)
//   SMTP_PORT=465  (SSL) ou 587 (TLS)
//   SMTP_USER=<seu-email-supabase>
//   SMTP_PASS=<sua-senha-smtp-supabase>
//   SMTP_FROM=ProConsig <noreply@seudominio.com>

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP não configurado — emails não serão enviados.');
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: (process.env.SMTP_PORT ?? '587') === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendMail(options: { to: string | string[]; subject: string; html: string }) {
  const transporter = createTransporter();
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'ProConsig <noreply@proconsig.com.br>',
      to: Array.isArray(options.to) ? options.to.join(',') : options.to,
      subject: options.subject,
      html: options.html
    });
  } catch (err) {
    console.error('[Email] Erro ao enviar:', err);
  }
}

// ── Actions ────────────────────────────────────────────────────────────────

export async function createSolicitacao(data: {
  bordero_id: string;
  tipo: 'alteracao' | 'exclusao';
  motivo: string;
  solicitante_id: string;
  solicitante_nome: string;
}) {
  try {
    const { error: insertError } = await supabaseAdmin.from('solicitacoes_alteracao').insert({
      bordero_id: data.bordero_id,
      tipo: data.tipo,
      motivo: data.motivo,
      status: 'pendente',
      solicitante_id: data.solicitante_id,
      dados_alteracao: data.tipo === 'alteracao' ? { note: 'Aguardando edição após aprovação.' } : null
    });

    if (insertError) return { error: 'Falha ao registrar solicitação: ' + insertError.message };

    // Notificar admins por email
    const { data: admins } = await supabaseAdmin
      .from('usuarios')
      .select('email')
      .eq('nivel', 'admin')
      .eq('status', 'ativo');

    const adminEmails = (admins ?? []).map((a: any) => a.email).filter(Boolean);

    if (adminEmails.length > 0) {
      await sendMail({
        to: adminEmails,
        subject: `Nova Solicitação de ${data.tipo === 'exclusao' ? 'Exclusão' : 'Alteração'} — ProConsig`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
            <h2 style="color: #4f46e5; margin-bottom: 16px;">Nova Solicitação no Sistema</h2>
            <table style="width:100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight:bold;">Usuário (Operacional):</td><td style="padding:8px;">${data.solicitante_nome}</td></tr>
              <tr style="background:#fff;"><td style="padding: 8px; font-weight:bold;">Borderô ID:</td><td style="padding:8px;font-family:monospace;">${data.bordero_id}</td></tr>
              <tr><td style="padding: 8px; font-weight:bold;">Tipo:</td><td style="padding:8px;">${data.tipo.toUpperCase()}</td></tr>
              <tr style="background:#fff;"><td style="padding: 8px; font-weight:bold;">Motivo:</td><td style="padding:8px;">${data.motivo}</td></tr>
            </table>
            <p style="margin-top:24px;color:#6b7280;">Acesse o painel para aprovar ou rejeitar.</p>
          </div>
        `
      });
    }

    return { success: true };
  } catch (err: any) {
    return { error: 'Erro interno: ' + err.message };
  }
}

export async function adminResolveSolicitacao(
  solicitacaoId: string,
  decision: 'aprovada' | 'rejeitada',
  adminId: string
) {
  try {
    const { data: sol, error: solError } = await supabaseAdmin
      .from('solicitacoes_alteracao')
      .select('*, borderos(cpf, valor, bordero_id)')
      .eq('id', solicitacaoId)
      .single();

    if (solError || !sol) return { error: 'Solicitação não encontrada: ' + (solError?.message ?? 'sem dados') };

    const { data: solicitante } = await supabaseAdmin
      .from('usuarios')
      .select('id, nome, email')
      .eq('id', sol.solicitante_id)
      .single();

    // Atualizar solicitação
    const { error: updErr } = await supabaseAdmin
      .from('solicitacoes_alteracao')
      .update({ status: decision, aprovador_id: adminId, resolved_at: new Date().toISOString() })
      .eq('id', solicitacaoId);

    if (updErr) return { error: 'Falha ao atualizar: ' + updErr.message };

    // Processar exclusão aprovada
    if (decision === 'aprovada' && sol.tipo === 'exclusao') {
      const { error: delErr } = await supabaseAdmin.from('borderos').delete().eq('id', sol.bordero_id);
      if (delErr) console.error('Falha ao excluir borderô:', delErr);
    }

    // Notificação interna (sino)
    const titulo = decision === 'aprovada' ? 'Solicitação Aprovada' : 'Solicitação Rejeitada';
    const mensagem = decision === 'aprovada'
      ? `Sua solicitação de ${sol.tipo} do borderô (CPF ${sol.borderos?.cpf}) foi aprovada.`
      : `Sua solicitação de ${sol.tipo} do borderô (CPF ${sol.borderos?.cpf}) foi rejeitada.`;

    await supabaseAdmin.from('notificacoes').insert({
      usuario_id: sol.solicitante_id,
      tipo: decision,
      titulo,
      mensagem,
      lida: false,
      link: '/borderos'
    });

    // Email para o solicitante
    if (solicitante?.email) {
      await sendMail({
        to: solicitante.email,
        subject: `Sua solicitação de ${sol.tipo} foi ${decision} — ProConsig`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
            <h2 style="color: ${decision === 'aprovada' ? '#16a34a' : '#dc2626'}; margin-bottom: 16px;">
              Aviso do ProConsig
            </h2>
            <p>Olá <strong>${solicitante.nome}</strong>,</p>
            <p>${mensagem}</p>
            <p style="margin-top:24px;color:#6b7280;">Acesse o painel para verificar.</p>
          </div>
        `
      });
    }

    return { success: true };
  } catch (err: any) {
    return { error: 'Erro interno: ' + err.message };
  }
}
