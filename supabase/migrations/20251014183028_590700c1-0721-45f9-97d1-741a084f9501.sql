-- Adicionar campos na tabela client_children
ALTER TABLE public.client_children 
ADD COLUMN IF NOT EXISTS genero gender_type,
ADD COLUMN IF NOT EXISTS numeracao_calca text,
ADD COLUMN IF NOT EXISTS data_registro_tamanho date DEFAULT now(),
ADD COLUMN IF NOT EXISTS data_registro_numeracao date;

-- Criar tabela de marcas
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de preferências de marcas dos clientes
CREATE TABLE IF NOT EXISTS public.client_brand_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(client_id, brand_id)
);

-- Habilitar RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_brand_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para brands
CREATE POLICY "Allow all operations on brands" ON public.brands
FOR ALL USING (true) WITH CHECK (true);

-- Políticas RLS para client_brand_preferences
CREATE POLICY "Allow all operations on client_brand_preferences" ON public.client_brand_preferences
FOR ALL USING (true) WITH CHECK (true);

-- Trigger para atualizar updated_at em brands
CREATE TRIGGER update_brands_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();