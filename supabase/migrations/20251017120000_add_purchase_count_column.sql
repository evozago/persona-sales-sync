-- Ensure the sales table stores the number of purchases per entry
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS quantidade_compras integer DEFAULT 0;
