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
    const normalizeNumber = (value: unknown) => {
      if (value === null || value === undefined) return 0;
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const sanitized = value
          .replace(/\s+/g, "")
          .replace(/\./g, "")
          .replace(/,/g, ".");
        const parsed = parseFloat(sanitized);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const normalizeInteger = (value: unknown) => {
      const num = normalizeNumber(value);
      if (!Number.isFinite(num)) return 0;
      const rounded = Math.round(num);
      return rounded > 0 ? rounded : 0;
    };

    let supportsPurchaseCount = true;
    const { error: purchaseColumnError } = await supabaseClient
      .from("sales")
      .select("quantidade_compras")
      .limit(1);

    if (purchaseColumnError && purchaseColumnError.message?.includes("quantidade_compras")) {
      console.warn("Column quantidade_compras not found. Proceeding without it.");
      supportsPurchaseCount = false;
    }


    // Process in batches
    for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
      const batch = jsonData.slice(i, i + BATCH_SIZE) as any[];
      const salesToInsert = [];

      for (const row of batch) {
        try {
          const clienteNome = row.cliente?.toString().trim();
          if (!clienteNome) continue;

                    const valorTotal = normalizeNumber(
            row.val_compras ?? row.valor_total ?? row.total_gasto ?? row.valor ?? 0,
          );
          const ticketMedioOriginal = normalizeNumber(row.ticket_medio ?? row.ticket_medio_cliente ?? 0);

          const purchaseCandidates = [
            row.quantidade_compras,
            row.qtd_compras,
            row.qtde_compras,
            row.qtde_compras_total,
            row.numero_compras,
            row.numero_de_compras,
          ];

          let quantidadeCompras = 0;
          for (const candidate of purchaseCandidates) {
            quantidadeCompras = normalizeInteger(candidate);
            if (quantidadeCompras > 0) break;
          }

          if (quantidadeCompras === 0 && valorTotal > 0 && ticketMedioOriginal > 0) {
            const derived = Math.round(valorTotal / ticketMedioOriginal);
            if (derived > 0) {
              quantidadeCompras = derived;
            }
          }

          const ticketMedio = quantidadeCompras > 0 ? valorTotal / quantidadeCompras : ticketMedioOriginal;


          const saleData = {
            cliente_nome: clienteNome,
            data_venda: convertExcelDate(row.ultima_compra) || new Date(),
            vendedora: row.ultimo_vendedor?.toString() || 'Não informado',
            quantidade_itens: parseInt(row.itens) || 0,
            valor_total: valorTotal,
            ticket_medio: ticketMedio || 0,
          };
          if (supportsPurchaseCount) {
            (saleData as Record<string, unknown>).quantidade_compras = quantidadeCompras;
          }
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
