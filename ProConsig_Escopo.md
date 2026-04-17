# ProConsig - Escopo do Projeto

## Visão Geral

Sistema web para gestão de clientes e borderôs com controle de acesso por níveis (Operacional e Administrador), fluxo de aprovação de usuários e solicitações de alteração.

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js (React) |
| Backend | Next.js API Routes |
| Banco de Dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Emails Customizados | Resend ou SendGrid |

---

## Níveis de Acesso

| Funcionalidade | Operacional | Administrador |
|---------------|:-----------:|:-------------:|
| Dashboard | Métricas gerais | Tudo + pendências |
| Gerenciar Usuários | ❌ Sem acesso | ✅ Acesso total |
| Configurações da Conta | Nome, email, senha | Todos os dados |
| Clientes - Consultar | ✅ | ✅ |
| Clientes - Cadastrar | ✅ (ao criar borderô) | ✅ |
| Clientes - Editar/Excluir | ❌ | ✅ |
| Clientes - Importar | ❌ | ✅ |
| Borderôs - Cadastrar | ✅ | ✅ |
| Borderôs - Visualizar | ✅ | ✅ |
| Borderôs - Editar/Excluir | ❌ (solicita ao admin) | ✅ |
| Relatórios | Relatórios gerais | Acesso total |

---

## Funcionalidades Detalhadas

### 1. Autenticação e Cadastro

#### Tela de Login
- Email e senha
- Link "Esqueci minha senha" (recuperação via Supabase)
- Link para cadastro

#### Tela de Cadastro

**Campos:**
- Nome completo
- Email
- Senha
- Confirmar senha

**Fluxo pós-cadastro:**
1. Usuário preenche formulário
2. Sistema cria conta no Supabase Auth (sem confirmação de email)
3. Sistema cria registro na tabela `usuarios` com `status = "pendente"` e `nivel = "operacional"`
4. Email automático enviado ao usuário: "Cadastro realizado! Aguardando aprovação do administrador"
5. Email automático enviado aos admins: "Novo usuário aguardando aprovação: [nome/email]"

#### Fluxo de Aprovação de Usuários
1. Admin acessa "Gerenciar Usuários"
2. Visualiza usuários pendentes
3. Pode: Aprovar, Rejeitar ou Excluir
4. Ao aprovar: define nível (Operacional ou Administrador)
5. Email enviado ao usuário informando aprovação ou rejeição

---

### 2. Dashboard

**Métricas exibidas:**
- Total de borderôs por status (cards ou gráfico)
- Valor total de borderôs (geral e por período selecionável)
- Borderôs pendentes de aprovação (apenas para admins)
- Últimos borderôs cadastrados (tabela com 5-10 registros)
- Total de clientes ativos

---

### 3. Gerenciar Usuários

> Visível apenas para Administradores

**Funcionalidades:**
- Listar todos os usuários (tabela com filtros)
- Visualizar detalhes de cada usuário
- Aprovar/Rejeitar usuários pendentes
- Alterar nível de acesso (Operacional ↔ Administrador)
- Revogar acesso (desativar usuário)
- Excluir usuário
- Reativar usuário desativado

**Colunas da tabela:**
- Nome
- Email
- Nível
- Status (Pendente / Ativo / Inativo)
- Data de cadastro
- Ações

---

### 4. Configurações da Conta

**Usuário Operacional pode editar:**
- Nome
- Email
- Trocar senha

**Usuário Admin pode editar:**
- Todos os campos acima
- Preferências de notificação (se aplicável)

---

### 5. Clientes

#### Campos
| Campo | Tipo | Obrigatório | Observação |
|-------|------|:-----------:|------------|
| CPF | texto | ✅ | Único, com máscara e validação de dígitos |
| Nome | texto | ✅ | |
| Banco | texto | ✅ | |
| Agência | texto | ✅ | |
| Conta | texto | ✅ | |
| Tipo Conta | seleção | ✅ | Corrente ou Poupança |

#### Funcionalidades
- Listar clientes (tabela com busca e filtros)
- Cadastrar novo cliente
- Editar cliente
- Excluir cliente (com confirmação)
- Importar clientes via CSV/Excel (apenas Admin)

#### Validações
- CPF único no sistema
- CPF válido (validação de dígitos verificadores)
- Todos os campos obrigatórios preenchidos

#### Permissões
- **Operacional:** Consultar + cadastrar novos clientes ao criar borderô
- **Admin:** Acesso total (criar, editar, excluir, importar)

---

### 6. Borderôs

#### Campos
| Campo | Tipo | Observação |
|-------|------|------------|
| CPF | texto | FK para clientes.cpf (obrigatório, validado) |
| Órgão | texto | |
| Empresa Ativação | texto | |
| Conta Ativação | texto | |
| Dia útil | texto | |
| Operação | texto | |
| Código Operação | texto | |
| Abat | texto | |
| Início | data | |
| Parcela | inteiro | |
| Saldo | decimal | |
| Contrato | texto | |
| Coef | decimal | |
| Prazo | inteiro | |
| Corretor | texto | |
| Banco | texto | |
| Agência | texto | |
| DV (Agência) | texto | |
| OP | texto | |
| Conta | texto | |
| DV (Conta) | texto | |
| Valor | decimal | |
| Status | texto | Ex: Pendente, Aprovado, Rejeitado, Processado |
| Empresa | texto | |
| Junção | texto | |
| Observação | texto | |

#### Permissões

**Usuário Operacional:**
- ✅ Cadastrar novo borderô
- ✅ Visualizar borderôs (lista e detalhes)
- ❌ Editar diretamente
- ❌ Excluir diretamente
- ✅ Solicitar alteração/exclusão (botão na tela de detalhes)

**Usuário Admin:**
- ✅ Acesso total (criar, editar, excluir)
- ✅ Visualizar e gerenciar solicitações de alteração pendentes
- ✅ Aprovar/Rejeitar solicitações

#### Validações
- CPF deve existir na base de clientes
- Se CPF não existir: exibir opção "Cadastrar novo cliente" inline
- Campos numéricos validados
- Valor deve ser maior que zero

#### Fluxo de Solicitação de Alteração/Exclusão

```
Operacional                          Sistema                           Admin
    |                                    |                                |
    |-- Clica "Solicitar Alteração" ---->|                                |
    |   (preenche motivo + campos)       |                                |
    |                                    |-- Cria registro na tabela ---->|
    |                                    |-- Envia email ao admin ------->|
    |                                    |-- Notificação em tela -------->|
    |                                    |                                |
    |                                    |<-- Admin aprova/rejeita -------|
    |<-- Email com decisão --------------|                                |
    |<-- Notificação em tela ------------|                                |
```

**Detalhamento:**
1. Operacional acessa borderô e clica em "Solicitar Alteração" ou "Solicitar Exclusão"
2. Abre modal/formulário com:
   - Tipo: Alteração ou Exclusão
   - Motivo (campo de texto obrigatório)
   - Se alteração: campos editáveis do borderô com valores propostos
3. Sistema cria registro na tabela `solicitacoes_alteracao`
4. Email enviado aos admins com dados do borderô e motivo
5. Notificação em tela para admins (badge/contador)
6. Admin acessa solicitações pendentes, visualiza detalhes
7. Admin aprova ou rejeita
8. Email enviado ao operacional informando decisão
9. Notificação em tela para o operacional

---

### 7. Relatórios

**Funcionalidades:**
- Filtros dinâmicos por qualquer campo (CPF, Banco, Corretor, Status, Período, etc.)
- Visualização em tabela na tela
- Exportação para CSV e TSV

**Relatórios sugeridos:**
- Borderôs por período
- Borderôs por corretor
- Borderôs por banco
- Borderôs por status
- Clientes por banco
- Relatório consolidado (totais e valores)

**Permissões:**
- Operacional: acesso a relatórios gerais
- Admin: acesso total

---

## Sistema de Notificações

### Notificações em Tela
- Badge/contador no menu (ex: "3 solicitações pendentes")
- Painel de notificações (dropdown ou página dedicada)
- Opção de marcar como lida

### Notificações por Email

| Evento | Destinatário | Assunto |
|--------|-------------|---------|
| Novo cadastro de usuário | Admins | "Novo usuário aguardando aprovação" |
| Cadastro realizado | Usuário | "Cadastro realizado! Aguardando aprovação" |
| Conta aprovada | Usuário | "Sua conta ProConsig foi aprovada!" |
| Conta rejeitada | Usuário | "Sua conta não foi aprovada" |
| Solicitação de alteração criada | Admins | "Nova solicitação de alteração de borderô" |
| Solicitação de exclusão criada | Admins | "Nova solicitação de exclusão de borderô" |
| Solicitação aprovada | Operacional | "Sua solicitação foi aprovada" |
| Solicitação rejeitada | Operacional | "Sua solicitação foi rejeitada" |

### Estratégia de Emails
- **Supabase Auth:** Recuperação de senha (template editado no painel)
- **Serviço externo (Resend/SendGrid):** Todos os emails de negócio listados acima
- **Confirmação de email do Supabase:** Desativada (aprovação é manual pelo admin)

---

## Estrutura de Dados

### Tabela: `usuarios`
```sql
id              UUID        PK, default gen_random_uuid()
supabase_user_id UUID      FK para auth.users, unique
nome            TEXT        NOT NULL
email           TEXT        NOT NULL, UNIQUE
nivel           TEXT        NOT NULL, CHECK (nivel IN ('operacional', 'admin'))
status          TEXT        NOT NULL, CHECK (status IN ('pendente', 'ativo', 'inativo'))
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### Tabela: `clientes`
```sql
id              UUID        PK, default gen_random_uuid()
cpf             TEXT        NOT NULL, UNIQUE
nome            TEXT        NOT NULL
banco           TEXT        NOT NULL
agencia         TEXT        NOT NULL
conta           TEXT        NOT NULL
tipo_conta      TEXT        NOT NULL, CHECK (tipo_conta IN ('corrente', 'poupanca'))
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
created_by      UUID        FK para usuarios.id
```

### Tabela: `borderos`
```sql
id                UUID        PK, default gen_random_uuid()
cpf               TEXT        NOT NULL, FK para clientes.cpf
orgao             TEXT
empresa_ativacao  TEXT
conta_ativacao    TEXT
dia_util          TEXT
operacao          TEXT
codigo_operacao   TEXT
abat              TEXT
inicio            DATE
parcela           INTEGER
saldo             DECIMAL(15,2)
contrato          TEXT
coef              DECIMAL(10,6)
prazo             INTEGER
corretor          TEXT
banco             TEXT
agencia           TEXT
agencia_dv        TEXT
op                TEXT
conta             TEXT
conta_dv          TEXT
valor             DECIMAL(15,2)
status            TEXT
empresa           TEXT
juncao            TEXT
observacao        TEXT
created_at        TIMESTAMPTZ DEFAULT now()
updated_at        TIMESTAMPTZ DEFAULT now()
created_by        UUID        FK para usuarios.id
updated_by        UUID        FK para usuarios.id
```

### Tabela: `solicitacoes_alteracao`
```sql
id              UUID        PK, default gen_random_uuid()
bordero_id      UUID        NOT NULL, FK para borderos.id
tipo            TEXT        NOT NULL, CHECK (tipo IN ('alteracao', 'exclusao'))
motivo          TEXT        NOT NULL
dados_alteracao JSONB       -- campos que serão alterados (null para exclusão)
status          TEXT        NOT NULL, CHECK (status IN ('pendente', 'aprovada', 'rejeitada'))
solicitante_id  UUID        NOT NULL, FK para usuarios.id
aprovador_id    UUID        FK para usuarios.id (nullable)
created_at      TIMESTAMPTZ DEFAULT now()
resolved_at     TIMESTAMPTZ -- preenchido quando aprovada/rejeitada
```

### Tabela: `notificacoes`
```sql
id              UUID        PK, default gen_random_uuid()
usuario_id      UUID        NOT NULL, FK para usuarios.id
tipo            TEXT        NOT NULL
titulo          TEXT        NOT NULL
mensagem        TEXT        NOT NULL
lida            BOOLEAN     DEFAULT false
link            TEXT        -- link para a página relacionada (nullable)
created_at      TIMESTAMPTZ DEFAULT now()
```

---

## Observações Técnicas

- Desativar confirmação de email do Supabase (aprovação é manual pelo admin)
- Sidebar com opção de recolher
- Usar templates customizados para todos os emails de negócio
- Interface limpa e responsiva
- Validações em todos os formulários (frontend e backend)
- Confirmação antes de exclusões
- Máscaras para CPF e valores monetários
- Paginação em todas as listagens
- Busca e filtros em tabelas

---

