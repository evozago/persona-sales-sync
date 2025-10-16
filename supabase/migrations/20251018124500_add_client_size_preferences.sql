-- Create table to associate clothing and shoe sizes with clients
CREATE TABLE IF NOT EXISTS public.client_size_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  size_id uuid NOT NULL REFERENCES public.sizes(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(client_id, size_id)
);

ALTER TABLE public.client_size_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on client_size_preferences" ON public.client_size_preferences
FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS client_size_preferences_client_id_idx ON public.client_size_preferences(client_id);
CREATE INDEX IF NOT EXISTS client_size_preferences_size_id_idx ON public.client_size_preferences(size_id);

CREATE TRIGGER update_client_size_preferences_updated_at
BEFORE UPDATE ON public.client_size_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
