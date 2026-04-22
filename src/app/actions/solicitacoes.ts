'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import nodemailer from 'nodemailer';

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
  venda_id: string;
  tipo: 'alteracao' | 'exclusao';
  motivo: string;
  solicitante_id: string;
  solicitante_nome: string;
}) {
  try {
    const { error: insertError } = await supabaseAdmin.from('solicitacoes_alteracao').insert({
      venda_id: data.venda_id,
      tipo: data.tipo,
      motivo: data.motivo,
      status: 'pendente',
      solicitante_id: data.solicitante_id,
      dados_alteracao: data.tipo === 'alteracao' ? { note: 'Aguardando edição após aprovação.' } : null
    });

    if (insertError) return { error: 'Falha ao registrar solicitação: ' + insertError.message };

    const { data: admins } = await supabaseAdmin
      .from('usuarios')
      .select('email')
      .eq('nivel', 'admin')
      .eq('status', 'ativo');

    const adminEmails = (admins ?? []).map((a: any) => a.email).filter(Boolean);

    if (adminEmails.length > 0) {
      await sendMail({
        to: adminEmails,
        subject: `Solicitação de ${data.tipo === 'exclusao' ? 'Exclusão' : 'Alteração'} de Venda — ProConsig`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
            <h2 style="color: #4f46e5; margin-bottom: 16px;">Nova Solicitação de Venda</h2>
            <table style="width:100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight:bold;">Operador:</td><td style="padding:8px;">${data.solicitante_nome}</td></tr>
              <tr style="background:#fff;"><td style="padding: 8px; font-weight:bold;">ID da Venda:</td><td style="padding:8px;font-family:monospace;">${data.venda_id}</td></tr>
              <tr><td style="padding: 8px; font-weight:bold;">Tipo:</td><td style="padding:8px;">${data.tipo.toUpperCase()}</td></tr>
              <tr style="background:#fff;"><td style="padding: 8px; font-weight:bold;">Motivo:</td><td style="padding:8px;">${data.motivo}</td></tr>
            </table>
            <p style="margin-top:24px;color:#6b7280;">Acesse o painel administrativo para processar esta solicitação.</p>
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
      .select('*, vendas(cpf, valor)')
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

    if (updErr) return { error: 'Falha ao atualizar solicitação: ' + updErr.message };

    // Processar exclusão aprovada
    if (decision === 'aprovada' && sol.tipo === 'exclusao') {
      const { error: delErr } = await supabaseAdmin.from('vendas').delete().eq('id', sol.venda_id);
      if (delErr) console.error('Falha ao excluir venda:', delErr);
    }

    // Notificação interna
    const titulo = decision === 'aprovada' ? 'Venda Aprovada para Ação' : 'Solicitação Rejeitada';
    const mensagem = decision === 'aprovada'
      ? `Sua solicitação de ${sol.tipo} da venda (CPF ${sol.vendas?.cpf}) foi aprovada.`
      : `Sua solicitação de ${sol.tipo} da venda (CPF ${sol.vendas?.cpf}) foi rejeitada pelo administrador.`;

    await supabaseAdmin.from('notificacoes').insert({
      usuario_id: sol.solicitante_id,
      tipo: decision,
      titulo,
      mensagem,
      lida: false,
      link: '/vendas'
    });

    // Email para o solicitante
    if (solicitante?.email) {
      await sendMail({
        to: solicitante.email,
        subject: `Sua solicitação de ${sol.tipo} foi ${decision} — ProConsig`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
            <h2 style="color: ${decision === 'aprovada' ? '#16a34a' : '#dc2626'}; margin-bottom: 16px;">
              Notificação de Decisão Administrativa
            </h2>
            <p>Olá <strong>${solicitante.nome}</strong>,</p>
            <p>${mensagem}</p>
            <p style="margin-top:24px;color:#6b7280;">Acesse o sistema para verificar os detalhes.</p>
          </div>
        `
      });
    }

    return { success: true };
  } catch (err: any) {
    return { error: 'Erro interno: ' + err.message };
  }
}
