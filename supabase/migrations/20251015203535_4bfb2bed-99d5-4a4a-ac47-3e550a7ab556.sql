-- Corrigir a constraint da tabela sizes para aceitar ambos formatos
ALTER TABLE sizes DROP CONSTRAINT IF EXISTS sizes_tipo_check;
ALTER TABLE sizes ADD CONSTRAINT sizes_tipo_check 
  CHECK (tipo IN ('roupa', 'Roupas', 'calçado', 'Calçados'));