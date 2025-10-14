-- Criar tabela de tamanhos/numerações
CREATE TABLE IF NOT EXISTS public.sizes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('roupa', 'calçado')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(nome, tipo)
);

-- Habilitar RLS
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Allow all operations on sizes" ON public.sizes
FOR ALL USING (true) WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sizes_updated_at
BEFORE UPDATE ON public.sizes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Alterar client_children para usar referências aos tamanhos
ALTER TABLE public.client_children 
DROP COLUMN IF EXISTS tamanho_roupa,
DROP COLUMN IF EXISTS numeracao_calca,
ADD COLUMN IF NOT EXISTS tamanho_roupa_id uuid REFERENCES public.sizes(id),
ADD COLUMN IF NOT EXISTS numeracao_calcado_id uuid REFERENCES public.sizes(id);