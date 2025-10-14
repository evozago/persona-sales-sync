-- Create enum for gender
CREATE TYPE gender_type AS ENUM ('Masculino', 'Feminino', 'Outro');

-- Create clients table
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  third_id text,
  nome text NOT NULL,
  cpf text,
  rg text,
  data_nascimento date,
  genero gender_type,
  telefone_1 text,
  telefone_2 text,
  telefone_3 text,
  email text,
  instagram text,
  facebook text,
  endereco_cep text,
  endereco_logradouro text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_uf text,
  observacao text,
  vendedora_responsavel text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create children table
CREATE TABLE client_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  nome text NOT NULL,
  data_nascimento date,
  tamanho_roupa text,
  created_at timestamptz DEFAULT now()
);

-- Create sales table
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  cliente_nome text NOT NULL,
  data_venda timestamptz NOT NULL,
  vendedora text NOT NULL,
  quantidade_itens integer DEFAULT 0,
  valor_total decimal(10,2) DEFAULT 0,
  ticket_medio decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create saleswomen table
CREATE TABLE saleswomen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  whatsapp_message_template text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE saleswomen ENABLE ROW LEVEL SECURITY;

-- Create policies (public access for now since no auth yet)
CREATE POLICY "Allow all operations on clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on children" ON client_children FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on sales" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on saleswomen" ON saleswomen FOR ALL USING (true) WITH CHECK (true);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_saleswomen_updated_at
  BEFORE UPDATE ON saleswomen
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert default saleswomen from the data
INSERT INTO saleswomen (nome) VALUES
  ('Jessica Maely Fleury Bueno'),
  ('Maria Julia Gomes Freitas Silva'),
  ('Julia Carolina Santiago Almeida'),
  ('Micaelly dos Santos Silva')
ON CONFLICT (nome) DO NOTHING;