import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

export async function sendEmail({
  to,
  subject,
  html,
  attachments
}: {
  to: string | string[],
  subject: string,
  html: string,
  attachments?: Array<{ content: Buffer | string; filename: string }>
}) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('ERRO RESEND: A variável de ambiente RESEND_API_KEY não está definida.');
      return { success: false, error: 'RESEND_API_KEY is not defined' };
    }

    // Load logo as CID inline attachment if it exists
    let logoAttachment: any = null;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'branding.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoAttachment = {
          content: logoBuffer,
          filename: 'branding.png',
          contentId: 'branding_logo'
        };
      }
    } catch (logoErr) {
      console.error('Erro ao carregar branding.png para anexo de e-mail:', logoErr);
    }

    const finalAttachments = attachments ? [...attachments] : [];
    if (logoAttachment) {
      finalAttachments.push(logoAttachment);
    }

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: 'Central Pagamentos <notificacoes@centralpagamentos.com.br>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      attachments: finalAttachments,
    });

    if (error) {
      console.error('Error sending email via Resend:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message || error };
  }
}
