-- Add a dedicated purchases count column
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS quantidade_compras integer DEFAULT 0;