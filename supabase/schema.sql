-- Schema definition for ProConsig

-- Tabela: usuarios
CREATE TABLE pro_consig.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id UUID REFERENCES auth.users(id) UNIQUE,
    nome TEXT NOT NULL,
    conta TEXT UNIQUE,
    email TEXT NOT NULL,
    nivel TEXT NOT NULL CHECK (nivel IN ('operacional', 'admin')),
    status TEXT NOT NULL CHECK (status IN ('pendente', 'ativo', 'inativo')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: clientes
CREATE TABLE pro_consig.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cpf TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    banco TEXT NOT NULL,
    agencia TEXT NOT NULL,
    conta TEXT NOT NULL,
    tipo_conta TEXT NOT NULL CHECK (tipo_conta IN ('corrente', 'poupanca')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES pro_consig.usuarios(id) ON DELETE SET NULL
);

-- Tabela: borderos
CREATE TABLE pro_consig.borderos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cpf TEXT NOT NULL REFERENCES pro_consig.clientes(cpf),
    orgao TEXT,
    empresa_ativacao TEXT,
    conta_ativacao TEXT,
    dia_util TEXT,
    operacao TEXT,
    codigo_operacao TEXT,
    abat TEXT,
    inicio DATE,
    parcela INTEGER,
    saldo DECIMAL(15,2),
    contrato TEXT,
    coef DECIMAL(10,6),
    prazo INTEGER,
    corretor TEXT,
    banco TEXT,
    agencia TEXT,
    agencia_dv TEXT,
    op TEXT,
    conta TEXT,
    conta_dv TEXT,
    valor DECIMAL(15,2),
    status TEXT,
    empresa TEXT,
    juncao TEXT,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES pro_consig.usuarios(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES pro_consig.usuarios(id) ON DELETE SET NULL
);

-- Tabela: solicitacoes_alteracao
CREATE TABLE pro_consig.solicitacoes_alteracao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bordero_id UUID NOT NULL REFERENCES pro_consig.borderos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('alteracao', 'exclusao')),
    motivo TEXT NOT NULL,
    dados_alteracao JSONB,
    status TEXT NOT NULL CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
    solicitante_id UUID NOT NULL REFERENCES pro_consig.usuarios(id) ON DELETE CASCADE,
    aprovador_id UUID REFERENCES pro_consig.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- Tabela: notificacoes
CREATE TABLE pro_consig.notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES pro_consig.usuarios(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security) - Desabilitado ou Habilitado
-- Como combinamos de fazer RLS e gerenciar com rotas de API, podemos inicializar:
ALTER TABLE pro_consig.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_consig.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_consig.borderos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_consig.solicitacoes_alteracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_consig.notificacoes ENABLE ROW LEVEL SECURITY;

-- Exemplo: Liberação de SELECT para autenticados (a regra real será mais granular depois se necessário)
-- CREATE POLICY "Permitir leitura para autenticados" ON pro_consig.usuarios FOR SELECT USING (auth.role() = 'authenticated');
-- Porém o usuário optou por acesso exclusivo por rotas API ou RLS. A reposta foi "controle de acesso exclusivamente nas rotas da API ou", que parou no 'ou'.
-- Assumiremos todo controle em rotas API usando supabase-admin para operações sensíveis, e o client supabase para verificação de sessão.
-- Para que o app frontend não use permissões RLS que compliquem, configuraremos permissões se necessário, ou desativaremos RLS se tudo passar pela API.
-- Como segurança boa prática, ativamos RLS e passamos service_role via API, o que ignora RLS. O cliente só recebe o que a API manda.

-- --- ATUALIZAÇÃO RECENTE DE RLS (PARA ACESSO VIA CLIENTE WEB) ---
-- Como o front-end está consultando as tabelas diretamente, precisamos destas políticas

CREATE POLICY "Permitir leitura para autenticados em usuarios" ON pro_consig.usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir leitura para autenticados em clientes" ON pro_consig.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir leitura para autenticados em borderos" ON pro_consig.borderos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir leitura para autenticados em solicitacoes" ON pro_consig.solicitacoes_alteracao FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir Insercao para autenticados em clientes" ON pro_consig.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir Insercao para autenticados em borderos" ON pro_consig.borderos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir Insercao para autenticados em solicitacoes" ON pro_consig.solicitacoes_alteracao FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir Alteracao para autenticados em clientes" ON pro_consig.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir Alteracao para autenticados em borderos" ON pro_consig.borderos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir Atualizacao para autenticados em solicitacoes" ON pro_consig.solicitacoes_alteracao FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Permitir Exclusao de clientes (apenas admin)" ON pro_consig.clientes FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM pro_consig.usuarios WHERE supabase_user_id = auth.uid() AND nivel = 'admin')
);
CREATE POLICY "Permitir Exclusao de borderos (apenas admin)" ON pro_consig.borderos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM pro_consig.usuarios WHERE supabase_user_id = auth.uid() AND nivel = 'admin')
);

-- Notificações: cada usuário só lê as próprias
CREATE POLICY "Usuarios leem suas proprias notificacoes" ON pro_consig.notificacoes FOR SELECT TO authenticated USING (
  usuario_id = (SELECT id FROM pro_consig.usuarios WHERE supabase_user_id = auth.uid())
);

-- Notificações: cada usuário pode atualizar (marcar como lida) as próprias notificações
CREATE POLICY "Usuarios atualizam suas proprias notificacoes" ON pro_consig.notificacoes FOR UPDATE TO authenticated
USING (
  usuario_id = (SELECT id FROM pro_consig.usuarios WHERE supabase_user_id = auth.uid())
)
WITH CHECK (
  usuario_id = (SELECT id FROM pro_consig.usuarios WHERE supabase_user_id = auth.uid())
);

-- Habilitar Realtime para notificações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE pro_consig.notificacoes;
