import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

type ImportStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function Imports() {
  const [clientsStatus, setClientsStatus] = useState<ImportStatus>('idle');
  const [salesStatus, setSalesStatus] = useState<ImportStatus>('idle');
  const [clientsResult, setClientsResult] = useState<any>(null);
  const [salesResult, setSalesResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFileUpload = async (
    file: File,
    type: 'clients' | 'sales'
  ) => {
    const setStatus = type === 'clients' ? setClientsStatus : setSalesStatus;
    const setResult = type === 'clients' ? setClientsResult : setSalesResult;

    setStatus('uploading');
    setResult(null);

    const convertExcelDate = (value: any) => {
      if (!value) return null;
      if (value instanceof Date) return value;
      if (typeof value === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + value * 86400000);
      }
      if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    };

    const processArrayField = (field: string | null | undefined): string[] => {
      if (!field || field === '[]' || field === 'nan') return [];
      
      // Converter para string e remover colchetes e aspas
      const cleanField = String(field)
        .replace(/[\[\]]/g, '')  // Remove colchetes
        .replace(/'/g, '')        // Remove aspas simples
        .replace(/"/g, '');       // Remove aspas duplas
      
      // Separar por vírgula e limpar
      return cleanField
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0 && item !== 'nan');
    };

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

      let imported = 0;
      let errors = 0;

      if (type === 'clients') {
        // Limpar dados antes de importar
        await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('client_brand_preferences').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('client_children').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('brands').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('sizes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // Nova estrutura: importar clientes com marcas e tamanhos
        for (const row of jsonData) {
          try {
            // Pular linhas sem nome de cliente
            if (!row.cliente) {
              errors++;
              continue;
            }

            const birthDate = row.data_aniversario_cliente ? convertExcelDate(row.data_aniversario_cliente) : null;
            const lastPurchaseDate = row.data_ultima_compra ? convertExcelDate(row.data_ultima_compra) : null;

            // Inserir cliente
            const { data: clientData, error: clientError } = await supabase
              .from('clients')
              .insert({
                nome: row.cliente?.toString().trim() || '',
                cpf: row.cpf_cliente?.toString().trim() || null,
                telefone_1: row.telefone_principal?.toString().trim() || null,
                data_nascimento: birthDate ? new Date(birthDate).toISOString().split('T')[0] : null,
                vendedora_responsavel: row.ultimo_vendedor?.toString().trim() || null,
              })
              .select()
              .single();

            if (clientError) {
              console.error('Client insert error:', clientError, row);
              errors++;
              continue;
            }

            if (!clientData) {
              console.error('No client data returned:', row);
              errors++;
              continue;
            }

            // Processar marcas
            const marcas = processArrayField(row.marcas_compradas);
            for (const marca of marcas) {
              // Inserir ou buscar marca
              const { data: brandData } = await supabase
                .from('brands')
                .select('id')
                .eq('nome', marca)
                .maybeSingle();

              let brandId = brandData?.id;

              if (!brandId) {
                const { data: newBrand } = await supabase
                  .from('brands')
                  .insert({ nome: marca })
                  .select()
                  .single();
                brandId = newBrand?.id;
              }

              // Vincular marca ao cliente
              if (brandId) {
                await supabase
                  .from('client_brand_preferences')
                  .insert({
                    client_id: clientData.id,
                    brand_id: brandId,
                  });
              }
            }

            // Processar tamanhos de roupas
            const tamanhosRoupas = processArrayField(row.tamanhos_comprados);
            for (const tamanho of tamanhosRoupas) {
              const { data: sizeData } = await supabase
                .from('sizes')
                .select('id')
                .eq('nome', tamanho)
                .eq('tipo', 'Roupas')
                .maybeSingle();

              if (!sizeData) {
                await supabase
                  .from('sizes')
                  .insert({ nome: tamanho, tipo: 'Roupas' });
              }
            }

            // Processar numerações de calçados
            const numeracoesCalcados = processArrayField(row.numeracao_comprados);
            for (const numeracao of numeracoesCalcados) {
              const { data: sizeData } = await supabase
                .from('sizes')
                .select('id')
                .eq('nome', numeracao)
                .eq('tipo', 'Calçados')
                .maybeSingle();

              if (!sizeData) {
                await supabase
                  .from('sizes')
                  .insert({ nome: numeracao, tipo: 'Calçados' });
              }
            }

            // Inserir venda resumida (só se tiver valores válidos)
            if (row.qtde_compras_total && row.total_gasto && lastPurchaseDate) {
              const valorTotal = parseFloat(row.total_gasto.toString().replace(',', '.')) || 0;
              const quantidadeItens = parseInt(row.qtde_compras_total.toString()) || 0;
              
              if (valorTotal > 0 && quantidadeItens > 0) {
                await supabase
                  .from('sales')
                  .insert({
                    client_id: clientData.id,
                    cliente_nome: row.cliente?.toString().trim() || '',
                    data_venda: new Date(lastPurchaseDate).toISOString(),
                    vendedora: row.ultimo_vendedor?.toString().trim() || '',
                    quantidade_itens: quantidadeItens,
                    valor_total: valorTotal,
                  });
              }
            }

            imported++;
          } catch (error: any) {
            console.error('Row processing error:', error);
            errors++;
          }
        }

        setStatus('success');
        setResult({ imported, errors, total: jsonData.length });
        toast({
          title: "Importação concluída!",
          description: `${imported} clientes importados${errors > 0 ? `, ${errors} erros` : ''}`,
        });
      } else {
        // Sales import não é mais necessário - dados vêm junto com clientes
        setStatus('success');
        setResult({ imported: 0, errors: 0, total: 0 });
        toast({
          title: "Importação de vendas",
          description: "Use a importação de clientes para importar vendas.",
        });
      }
    } catch (error: any) {
      console.error('Import error:', error);
      setStatus('error');
      toast({
        title: "Erro na importação",
        description: error.message || "Ocorreu um erro ao processar o arquivo",
        variant: "destructive",
      });
    }
  };


  const ImportCard = ({
    title,
    description,
    status,
    result,
    onFileSelect,
    gradient,
  }: {
    title: string;
    description: string;
    status: ImportStatus;
    result: any;
    onFileSelect: (file: File) => void;
    gradient: string;
  }) => (
    <Card className="p-8 text-center space-y-4 hover:shadow-elevated transition-all">
      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} mx-auto flex items-center justify-center`}>
        {status === 'uploading' ? (
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        ) : status === 'success' ? (
          <CheckCircle className="w-8 h-8 text-white" />
        ) : status === 'error' ? (
          <AlertCircle className="w-8 h-8 text-white" />
        ) : (
          <Upload className="w-8 h-8 text-white" />
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
      </div>

      {result && (
        <div className="p-4 bg-muted rounded-lg text-sm space-y-1">
          <p className="text-success font-semibold">✓ {result.imported} importados</p>
          {result.errors > 0 && (
            <p className="text-destructive">✗ {result.errors} erros</p>
          )}
          <p className="text-muted-foreground">Total: {result.total} linhas</p>
        </div>
      )}

      <div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          id={`file-${title}`}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file);
          }}
          disabled={status === 'uploading'}
        />
        <Button
          onClick={() => document.getElementById(`file-${title}`)?.click()}
          disabled={status === 'uploading'}
          className={`bg-gradient-to-r ${gradient} hover:opacity-90`}
        >
          {status === 'uploading' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Selecionar Arquivo
            </>
          )}
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Importações
        </h1>
        <p className="text-muted-foreground mt-2">Importe dados de planilhas Excel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ImportCard
          title="Importar Clientes"
          description="Faça upload da planilha unificada"
          status={clientsStatus}
          result={clientsResult}
          onFileSelect={(file) => handleFileUpload(file, 'clients')}
          gradient="from-primary to-primary-glow"
        />

        <ImportCard
          title="Importar Vendas"
          description="Não disponível - use importação de clientes"
          status={salesStatus}
          result={salesResult}
          onFileSelect={(file) => handleFileUpload(file, 'sales')}
          gradient="from-accent to-secondary"
        />
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Instruções de Importação</h3>
        <div className="space-y-3 text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">📊 Formato da Planilha:</p>
            <ul className="space-y-1 ml-4">
              <li>• Colunas: cliente, cpf_cliente, telefone_principal, data_aniversario_cliente</li>
              <li>• qtde_compras_total, total_gasto, data_ultima_compra, ultimo_vendedor</li>
              <li>• marcas_compradas, tamanhos_comprados, numeracao_comprados</li>
            </ul>
          </div>
          
          <div>
            <p className="font-medium text-foreground mb-1">🏷️ Formato de Arrays:</p>
            <ul className="space-y-1 ml-4">
              <li>• Arrays devem estar no formato: ['ITEM1', 'ITEM2']</li>
              <li>• marcas_compradas → cria/vincula marcas</li>
              <li>• tamanhos_comprados → cria tamanhos de Roupas</li>
              <li>• numeracao_comprados → cria tamanhos de Calçados</li>
            </ul>
          </div>

          <div className="pt-3 border-t border-border">
            <p className="font-medium text-foreground mb-1">⚠️ Observações:</p>
            <ul className="space-y-1 ml-4">
              <li>• Cada cliente será importado com marcas, tamanhos e resumo de vendas</li>
              <li>• Dados faltantes podem ser completados manualmente depois</li>
              <li>• Marcas e tamanhos serão criados automaticamente se não existirem</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
