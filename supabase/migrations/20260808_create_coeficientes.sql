-- Migration: Criar tabela de coeficientes e politicas RLS
CREATE TABLE IF NOT EXISTS pro_consig.coeficientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prazo INTEGER NOT NULL,
    coef_min NUMERIC(10,6) NOT NULL,
    coef_max NUMERIC(10,6) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pro_consig.coeficientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de coeficientes para autenticados" ON pro_consig.coeficientes;
CREATE POLICY "Permitir leitura de coeficientes para autenticados" 
ON pro_consig.coeficientes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir insercao de coeficientes para admin" ON pro_consig.coeficientes;
CREATE POLICY "Permitir insercao de coeficientes para admin" 
ON pro_consig.coeficientes FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM pro_consig.usuarios WHERE supabase_user_id = auth.uid() AND nivel = 'admin')
);

DROP POLICY IF EXISTS "Permitir alteracao de coeficientes para admin" ON pro_consig.coeficientes;
CREATE POLICY "Permitir alteracao de coeficientes para admin" 
ON pro_consig.coeficientes FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM pro_consig.usuarios WHERE supabase_user_id = auth.uid() AND nivel = 'admin')
);

DROP POLICY IF EXISTS "Permitir exclusao de coeficientes para admin" ON pro_consig.coeficientes;
CREATE POLICY "Permitir exclusao de coeficientes para admin" 
ON pro_consig.coeficientes FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM pro_consig.usuarios WHERE supabase_user_id = auth.uid() AND nivel = 'admin')
);

-- Carga inicial de coeficientes se a tabela estiver vazia
INSERT INTO pro_consig.coeficientes (prazo, coef_min, coef_max)
SELECT * FROM (VALUES
  (1, 1.170000, 1.400000),
  (3, 0.531000, 0.635000),
  (4, 0.366000, 0.399000),
  (6, 0.320000, 0.341000),
  (8, 0.260000, 0.295000),
  (12, 0.189000, 0.205000),
  (15, 0.149000, 0.165000)
) AS v(prazo, coef_min, coef_max)
WHERE NOT EXISTS (SELECT 1 FROM pro_consig.coeficientes);
