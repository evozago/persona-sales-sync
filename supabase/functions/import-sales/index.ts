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

    console.log('Processing sales file:', file.name);

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

    console.log('Sales rows found:', jsonData.length);

    let imported = 0;
    let errors = 0;

    for (const row of jsonData as any[]) {
      try {
        // Convert Excel date serial numbers to JavaScript dates
        const convertExcelDate = (serial: any) => {
          if (!serial) return null;
          if (typeof serial === 'string') return new Date(serial);
          // Excel date serial: days since 1900-01-01
          const excelEpoch = new Date(1899, 11, 30);
          const date = new Date(excelEpoch.getTime() + serial * 86400000);
          return date;
        };

        const saleData = {
          cliente_nome: row.cliente || 'Cliente desconhecido',
          data_venda: convertExcelDate(row.ultima_compra) || new Date(),
          vendedora: row.ultimo_vendedor || 'Não informado',
          quantidade_itens: parseInt(row.itens) || 0,
          valor_total: parseFloat(row.val_compras) || 0,
          ticket_medio: parseFloat(row.ticket_medio) || 0,
        };

        if (!saleData.cliente_nome || saleData.cliente_nome === 'Cliente desconhecido') {
          continue;
        }

        // Try to find client by name
        const { data: clientData } = await supabaseClient
          .from('clients')
          .select('id')
          .ilike('nome', saleData.cliente_nome)
          .limit(1)
          .single();

        if (clientData) {
          (saleData as any).client_id = clientData.id;
        }

        const { error } = await supabaseClient
          .from('sales')
          .insert(saleData);

        if (error) {
          console.error('Error inserting sale:', error);
          errors++;
        } else {
          imported++;
        }
      } catch (err) {
        console.error('Error processing sale row:', err);
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
