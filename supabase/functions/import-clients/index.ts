import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log('Processing file:', file.name);

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    // Parse Excel file
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

    console.log('Rows found:', jsonData.length);

    let imported = 0;
    let errors = 0;

    for (const row of jsonData as any[]) {
      try {
        // Map Excel columns to database columns
        const clientData = {
          third_id: row.third_id || null,
          nome: row.nome || 'Cliente sem nome',
          cpf: row.cpf || null,
          rg: row.rg || null,
          data_nascimento: row.data_nascimento ? new Date(row.data_nascimento) : null,
          genero: row.genero || null,
          telefone_1: row.telefone_1 || null,
          telefone_2: row.telefone_2 || null,
          telefone_3: row.telefone_3 || null,
          email: row.email || null,
          endereco_cep: row.endereco_1_cep || null,
          endereco_logradouro: row.endereco_1_logradouro || null,
          endereco_numero: row.endereco_1_numero || null,
          endereco_complemento: row.endereco_1_complemento || null,
          endereco_bairro: row.endereco_1_bairro || null,
          endereco_cidade: row.endereco_1_cidade || null,
          endereco_uf: row.endereco_1_uf || null,
          observacao: row.observacao || null,
        };

        // Skip empty rows
        if (!clientData.nome || clientData.nome === 'Cliente sem nome') {
          continue;
        }

        // Insert or update client
        const { error } = await supabaseClient
          .from('clients')
          .upsert(clientData, { 
            onConflict: 'third_id',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error('Error inserting client:', error);
          errors++;
        } else {
          imported++;
        }
      } catch (err) {
        console.error('Error processing row:', err);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        errors,
        total: jsonData.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
