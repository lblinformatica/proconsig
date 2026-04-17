import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
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

    const pseudoEmail = `${conta.toLowerCase()}@proconsig.system`;

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
    const { data: admins } = await supabaseAdmin
      .from('usuarios')
      .select('email')
      .eq('nivel', 'admin')
      .eq('status', 'ativo');

    const adminEmails = admins?.map(a => a.email) || [];

    // 4. Enviar emails
    // Email para o usuário
    await sendEmail({
      to: email,
      subject: 'Cadastro realizado! Aguardando aprovação',
      html: `<p>Olá ${nome},</p><p>Seu cadastro foi realizado com sucesso. Sua conta está aguardando aprovação do administrador do sistema.</p>`
    });

    // Email para admins
    if (adminEmails.length > 0) {
      await sendEmail({
        to: adminEmails,
        subject: 'Novo usuário aguardando aprovação',
        html: `<p>Um novo usuário solicitou acesso ao sistema:</p><ul><li>Nome: ${nome}</li><li>Conta (Username): ${conta}</li><li>E-mail: ${email}</li></ul><p>Acesse o painel do ProConsig para revisar.</p>`
      });
    }

    return NextResponse.json({ success: true, message: 'Usuário registrado com sucesso.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
