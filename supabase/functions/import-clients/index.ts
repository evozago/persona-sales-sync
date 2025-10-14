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

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

    console.log('Total rows found:', jsonData.length);

    let imported = 0;
    let errors = 0;
    const BATCH_SIZE = 100;

    // Process in batches to avoid timeout
    for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
      const batch = jsonData.slice(i, i + BATCH_SIZE) as any[];
      const clientsToInsert = [];

      for (const row of batch) {
        try {
          // Skip rows without name or with role="CLIENT"
          const nome = row.nome?.toString().trim();
          if (!nome || nome === '' || row.roles !== 'CLIENT') {
            continue;
          }

          const clientData = {
            third_id: row.third_id?.toString() || null,
            nome: nome,
            cpf: row.cpf?.toString() || null,
            rg: row.rg?.toString() || null,
            data_nascimento: row.data_nascimento ? new Date(row.data_nascimento).toISOString().split('T')[0] : null,
            genero: row.genero || null,
            telefone_1: row.telefone_1?.toString() || null,
            telefone_2: row.telefone_2?.toString() || null,
            telefone_3: row.telefone_3?.toString() || null,
            email: row.email?.toString() || null,
            endereco_cep: row.endereco_1_cep?.toString() || null,
            endereco_logradouro: row.endereco_1_logradouro?.toString() || null,
            endereco_numero: row.endereco_1_numero?.toString() || null,
            endereco_complemento: row.endereco_1_complemento?.toString() || null,
            endereco_bairro: row.endereco_1_bairro?.toString() || null,
            endereco_cidade: row.endereco_1_cidade?.toString() || null,
            endereco_uf: row.endereco_1_uf?.toString() || null,
            observacao: row.observacao?.toString() || null,
          };

          clientsToInsert.push(clientData);
        } catch (err) {
          console.error('Error processing row:', err);
          errors++;
        }
      }

      // Bulk insert batch
      if (clientsToInsert.length > 0) {
        const { error } = await supabaseClient
          .from('clients')
          .insert(clientsToInsert);

        if (error) {
          console.error('Batch insert error:', error);
          errors += clientsToInsert.length;
        } else {
          imported += clientsToInsert.length;
        }
      }

      console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}: ${imported} imported, ${errors} errors`);
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
