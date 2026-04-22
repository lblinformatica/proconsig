require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  console.log('Testing Resend with Key:', process.env.RESEND_API_KEY ? 'Present' : 'Missing');
  try {
    const { data, error } = await resend.emails.send({
      from: 'Central de Pagamentos <notificacoes@centralpagamentos.com.br>',
      to: ['lblinformatica.net@gmail.com'], // E-mail de teste
      subject: 'Teste de Envio - ProConsig',
      html: '<p>Este é um teste de envio de e-mail do ProConsig.</p>',
    });

    if (error) {
      console.error('Error from Resend:', JSON.stringify(error, null, 2));
    } else {
      console.log('Success!', data);
    }
  } catch (err) {
    console.error('Fatal Error:', err);
  }
}

test();
