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

    console.log('Total sales rows found:', jsonData.length);

    let imported = 0;
    let errors = 0;
    const BATCH_SIZE = 50;

    // Convert Excel date serial numbers
    const convertExcelDate = (serial: any) => {
      if (!serial) return null;
      if (typeof serial === 'string') return new Date(serial);
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + serial * 86400000);
    };

    // Process in batches
    for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
      const batch = jsonData.slice(i, i + BATCH_SIZE) as any[];
      const salesToInsert = [];

      for (const row of batch) {
        try {
          const clienteNome = row.cliente?.toString().trim();
          if (!clienteNome) continue;

          const saleData = {
            cliente_nome: clienteNome,
            data_venda: convertExcelDate(row.ultima_compra) || new Date(),
            vendedora: row.ultimo_vendedor?.toString() || 'Não informado',
            quantidade_itens: parseInt(row.itens) || 0,
            valor_total: parseFloat(row.val_compras) || 0,
            ticket_medio: parseFloat(row.ticket_medio) || 0,
          };

          salesToInsert.push(saleData);
        } catch (err) {
          console.error('Error processing sale row:', err);
          errors++;
        }
      }

      // Bulk insert batch
      if (salesToInsert.length > 0) {
        const { error } = await supabaseClient
          .from('sales')
          .insert(salesToInsert);

        if (error) {
          console.error('Batch insert error:', error);
          errors += salesToInsert.length;
        } else {
          imported += salesToInsert.length;
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
