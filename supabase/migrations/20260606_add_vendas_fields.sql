-- Migration: Adicionar campos novo_cliente e atualizacao_cadastral na tabela de vendas
ALTER TABLE pro_consig.vendas 
  ADD COLUMN IF NOT EXISTS novo_cliente VARCHAR(10) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS atualizacao_cadastral VARCHAR(10) DEFAULT NULL;
