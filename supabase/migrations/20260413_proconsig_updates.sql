-- ============================================================
-- ProConsig — Migration: atualizações completas 2026-04
-- ============================================================

-- 1. Tabela de bancos brasileiros (lookup por código)
CREATE TABLE IF NOT EXISTS pro_consig.bancos (
  codigo VARCHAR(10) PRIMARY KEY,
  nome   VARCHAR(100) NOT NULL
);

-- Inserir os bancos mais comuns
INSERT INTO pro_consig.bancos (codigo, nome) VALUES
  ('001', 'Banco do Brasil'),
  ('033', 'Santander'),
  ('041', 'Banrisul'),
  ('069', 'Banco Crefisa'),
  ('077', 'Banco Inter'),
  ('084', 'Uniprime Norte do Paraná'),
  ('085', 'Cooperativa Central de Crédito – Ailos'),
  ('099', 'Uniprime Central'),
  ('104', 'Caixa Econômica Federal'),
  ('237', 'Bradesco'),
  ('260', 'Nu Pagamentos (Nubank)'),
  ('290', 'Pagseguro'),
  ('318', 'Banco BMG'),
  ('341', 'Itaú Unibanco'),
  ('389', 'Banco Mercantil do Brasil'),
  ('422', 'Banco Safra'),
  ('623', 'Banco Pan'),
  ('633', 'Banco Rendimento'),
  ('655', 'Banco Votorantim (BV)'),
  ('707', 'Banco Daycoval'),
  ('739', 'Banco Cetelem'),
  ('745', 'Citibank'),
  ('748', 'Sicredi'),
  ('756', 'Sicoob')
ON CONFLICT (codigo) DO NOTHING;

-- 2. Adicionar campos de crédito e DV/OP na tabela clientes
ALTER TABLE pro_consig.clientes
  ADD COLUMN IF NOT EXISTS agencia_dv     VARCHAR(5),
  ADD COLUMN IF NOT EXISTS conta_dv       VARCHAR(5),
  ADD COLUMN IF NOT EXISTS op             VARCHAR(10),
  ADD COLUMN IF NOT EXISTS forma_credito  VARCHAR(20),   -- 'conta' ou 'pix'
  -- Dados bancários para crédito em conta
  ADD COLUMN IF NOT EXISTS credito_banco      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS credito_agencia    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS credito_agencia_dv VARCHAR(5),
  ADD COLUMN IF NOT EXISTS credito_tipo_conta VARCHAR(20),
  ADD COLUMN IF NOT EXISTS credito_conta      VARCHAR(30),
  ADD COLUMN IF NOT EXISTS credito_conta_dv   VARCHAR(5),
  -- Dados PIX
  ADD COLUMN IF NOT EXISTS pix_tipo_chave VARCHAR(20),   -- 'email','cpf','telefone','aleatoria'
  ADD COLUMN IF NOT EXISTS pix_chave      VARCHAR(150);

-- 3. ID amigável no borderô (formato: yyyymm-nnn)
ALTER TABLE pro_consig.borderos
  ADD COLUMN IF NOT EXISTS bordero_id VARCHAR(20) UNIQUE;

-- Função para gerar o bordero_id automaticamente
CREATE OR REPLACE FUNCTION pro_consig.gerar_bordero_id()
RETURNS TRIGGER AS $$
DECLARE
  ano_mes TEXT;
  seq     INT;
BEGIN
  ano_mes := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM');

  -- Conta os borderôs gerados no mesmo ano+mês
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(bordero_id, '-', 2) AS INT)
  ), 0) + 1
  INTO seq
  FROM pro_consig.borderos
  WHERE bordero_id LIKE ano_mes || '-%';

  NEW.bordero_id := ano_mes || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para chamar a função no INSERT
DROP TRIGGER IF EXISTS trigger_bordero_id ON pro_consig.borderos;
CREATE TRIGGER trigger_bordero_id
  BEFORE INSERT ON pro_consig.borderos
  FOR EACH ROW
  WHEN (NEW.bordero_id IS NULL)
  EXECUTE FUNCTION pro_consig.gerar_bordero_id();

-- 4. Garantir que borderos tem campo status com padrão 'Aprovado'
ALTER TABLE pro_consig.borderos
  ALTER COLUMN status SET DEFAULT 'Aprovado';

-- 5. RLS: política de SELECT para bancos (todos autenticados podem ler)
ALTER TABLE pro_consig.bancos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados leem bancos"
  ON pro_consig.bancos
  FOR SELECT
  TO authenticated
  USING (true);
