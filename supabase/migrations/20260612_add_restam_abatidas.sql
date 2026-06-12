-- Migration: Adicionar campos restam e abatidas na tabela de vendas
ALTER TABLE pro_consig.vendas 
  ADD COLUMN IF NOT EXISTS restam INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS abatidas INTEGER DEFAULT NULL;
