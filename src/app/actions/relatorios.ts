'use server';

import { sendEmail } from '@/lib/email';

export async function sendRelatorioEmail({
  to,
  subject,
  html,
  base64Attachment,
  filename
}: {
  to: string;
  subject: string;
  html: string;
  base64Attachment: string;
  filename: string;
}) {
  try {
    const result = await sendEmail({
      to,
      subject,
      html,
      attachments: [
        {
          content: Buffer.from(base64Attachment, 'base64'),
          filename
        }
      ]
    });
    return result;
  } catch (err: any) {
    console.error('Erro ao enviar email do relatorio:', err);
    return { success: false, error: err.message };
  }
}
