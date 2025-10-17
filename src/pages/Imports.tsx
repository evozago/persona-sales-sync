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
  const [isClearing, setIsClearing] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('client_brand_preferences').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('client_children').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('brands').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('sizes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      toast({
        title: "Dados limpos!",
        description: "Todos os dados foram removidos com sucesso.",
      });
    } catch (error: any) {
      console.error('Clear data error:', error);
      toast({
        title: "Erro ao limpar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleFileUpload = async (
    file: File,
    type: 'clients' | 'sales'
  ) => {
    const setStatus = type === 'clients' ? setClientsStatus : setSalesStatus;
    const setResult = type === 'clients' ? setClientsResult : setSalesResult;

    setStatus('uploading');
    setResult(null);
    
    const normalizeNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const sanitized = value
          .replace(/\s+/g, '')
          .replace(/\./g, '')
          .replace(/,/g, '.');
        const parsed = parseFloat(sanitized);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const normalizeInteger = (value: any): number => {
      const num = normalizeNumber(value);
      if (!Number.isFinite(num)) return 0;
      const rounded = Math.round(num);
      return rounded > 0 ? rounded : 0;
    };


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
                let supportsPurchaseCount = true;
        const { error: purchaseColumnError } = await supabase
          .from('sales')
          .select('quantidade_compras')
          .limit(1);

        if (purchaseColumnError && purchaseColumnError.message?.includes('quantidade_compras')) {
          console.warn('Coluna quantidade_compras não encontrada. Prosseguindo sem controle de duplicidade.');
          supportsPurchaseCount = false;
        }


        setImportProgress({ current: 0, total: jsonData.length });
        
        // Coletar todas as marcas e tamanhos únicos para inserção em lote
        const allBrands = new Set<string>();
        const allSizesRoupas = new Set<string>();
        const allSizesCalcados = new Set<string>();
        
        for (const row of jsonData) {
          const marcas = processArrayField(row.marcas_compradas);
          const tamanhosRoupas = processArrayField(row.tamanhos_comprados);
          const numeracoesCalcados = processArrayField(row.numeracao_comprados);
          
          marcas.forEach(m => allBrands.add(m));
          tamanhosRoupas.forEach(t => allSizesRoupas.add(t));
          numeracoesCalcados.forEach(n => allSizesCalcados.add(n));
        }
        
        // Inserir todas as marcas de uma vez
        if (allBrands.size > 0) {
          const brandsToInsert = Array.from(allBrands).map(nome => ({ nome }));
          await supabase
            .from('brands')
            .upsert(brandsToInsert, { onConflict: 'nome', ignoreDuplicates: true });
        }
        
        // Inserir todos os tamanhos de roupas de uma vez
        if (allSizesRoupas.size > 0) {
          const sizesToInsert = Array.from(allSizesRoupas).map(nome => ({ nome, tipo: 'Roupas' }));
          for (const size of sizesToInsert) {
            try {
              await supabase
                .from('sizes')
                .upsert(size, { onConflict: 'nome,tipo', ignoreDuplicates: true });
            } catch (error) {
              console.warn(`Erro ao inserir tamanho ${size.nome}:`, error);
            }
          }
        }
        
        // Inserir todos os tamanhos de calçados de uma vez
        if (allSizesCalcados.size > 0) {
          const sizesToInsert = Array.from(allSizesCalcados).map(nome => ({ nome, tipo: 'Calçados' }));
          for (const size of sizesToInsert) {
            try {
              await supabase
                .from('sizes')
                .upsert(size, { onConflict: 'nome,tipo', ignoreDuplicates: true });
            } catch (error) {
              console.warn(`Erro ao inserir numeração ${size.nome}:`, error);
            }
          }
        }

        // Processar cada cliente
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          try {
            // Atualizar progresso
            setImportProgress({ current: i + 1, total: jsonData.length });
            
            // Pular linhas sem nome de cliente
            if (!row.cliente || String(row.cliente).trim() === '') {
              errors++;
              continue;
            }

            const birthDate = row.data_aniversario_cliente ? convertExcelDate(row.data_aniversario_cliente) : null;
            const lastPurchaseDate = row.data_ultima_compra ? convertExcelDate(row.data_ultima_compra) : null;
            const cpf = row.cpf_cliente?.toString().trim() || null;
            const nome = row.cliente?.toString().trim() || '';

            // Verificar se cliente já existe (por CPF ou nome)
            let existingClient = null;
            if (cpf) {
              const { data } = await supabase
                .from('clients')
                .select('*')
                .eq('cpf', cpf)
                .maybeSingle();
              existingClient = data;
            }
            
            // Se não encontrou por CPF, buscar por nome
            if (!existingClient && nome) {
              const { data } = await supabase
                .from('clients')
                .select('*')
                .eq('nome', nome)
                .maybeSingle();
              existingClient = data;
            }

            let clientData;
            
            if (existingClient) {
              // Cliente existe - atualizar apenas vendedora responsável
              const { data: updatedClient } = await supabase
                .from('clients')
                .update({
                  vendedora_responsavel: row.ultimo_vendedor?.toString().trim() || existingClient.vendedora_responsavel,
                })
                .eq('id', existingClient.id)
                .select()
                .single();
              
              clientData = updatedClient || existingClient;
            } else {
              // Cliente novo - inserir todos os dados
              const { data: newClient, error: clientError } = await supabase
                .from('clients')
                .insert({
                  nome,
                  cpf,
                  telefone_1: row.telefone_principal?.toString().trim() || null,
                  data_nascimento: birthDate ? new Date(birthDate).toISOString().split('T')[0] : null,
                  vendedora_responsavel: row.ultimo_vendedor?.toString().trim() || null,
                })
                .select()
                .single();

              if (clientError) {
                console.error(`Erro ao inserir cliente linha ${i + 1}:`, clientError.message);
                errors++;
                continue;
              }

              clientData = newClient;
            }

            if (!clientData) {
              console.error(`Sem dados de cliente retornados - linha ${i + 1}`);
              errors++;
              continue;
            }

            // Processar marcas - adicionar apenas as que não existem
            const marcas = processArrayField(row.marcas_compradas);
            
            // Buscar marcas já vinculadas ao cliente
            const { data: existingPrefs } = await supabase
              .from('client_brand_preferences')
              .select('brand_id, brands(nome)')
              .eq('client_id', clientData.id);
            
            const existingBrandNames = new Set(
              existingPrefs?.map((p: any) => p.brands?.nome).filter(Boolean) || []
            );
            
            for (const marca of marcas) {
              // Pular se marca já está vinculada
              if (existingBrandNames.has(marca)) continue;
              
              try {
                const { data: brandData } = await supabase
                  .from('brands')
                  .select('id')
                  .eq('nome', marca)
                  .maybeSingle();

                if (brandData?.id) {
                  await supabase
                    .from('client_brand_preferences')
                    .insert({
                      client_id: clientData.id,
                      brand_id: brandData.id,
                    })
                    .select();
                }
              } catch (error: any) {
                console.warn(`Erro ao vincular marca ${marca}:`, error.message);
              }
            }

            // Processar vendas - somar aos valores existentes
            if (row.total_gasto && lastPurchaseDate) {
              try {
                const valorTotal = normalizeNumber(row.total_gasto);


                // Tentar diferentes formatos para quantidade de compras
                const qtdCompras =
                  row.qtde_compras_total ||
                  row.qtde_compras ||
                  row.quantidade_compras ||
                  row.qtd_compras ||
                  row.numero_compras ||
                  row.numero_de_compras ||
                  0;
                let quantidadeCompras = normalizeInteger(qtdCompras);

                if (quantidadeCompras === 0) {
                  const ticketMedioPlanilha = normalizeNumber(row.ticket_medio);
                  if (valorTotal > 0 && ticketMedioPlanilha > 0) {
                    const derived = Math.round(valorTotal / ticketMedioPlanilha);
                    if (derived > 0) {
                      quantidadeCompras = derived;
                    }
                  }
                }

                
                console.log(`Cliente ${nome}: ${quantidadeCompras} compras, R$ ${valorTotal}`);
                
                if (valorTotal > 0 && quantidadeCompras > 0) {
                  // Buscar vendas existentes do cliente
                  const { data: existingSales, error: existingError } = await supabase
                    .from('sales')
                    .select(supportsPurchaseCount ? 'quantidade_compras, valor_total' : 'valor_total')
                    .eq('client_id', clientData.id);
                  if (existingError && !existingError.message?.includes('quantidade_compras')) {
                    throw existingError;
                  }


                  // Totais já registrados no sistema
                  const existingPurchases = supportsPurchaseCount
                    ? existingSales?.reduce((sum: number, s: any) => sum + (s.quantidade_compras || 0), 0) || 0
                    : 0;
                  const existingValue = existingSales?.reduce((sum, s) => sum + (Number(s.valor_total) || 0), 0) || 0;

                  // Calcula apenas o DELTA a adicionar (idempotente)
                  const deltaPurchases = quantidadeCompras - existingPurchases;
                  const deltaValue = valorTotal - existingValue;

                  if (deltaPurchases > 0 && deltaValue > 0) {
                    const ticketMedio = deltaValue / deltaPurchases;
                    
                    const saleRecord: Record<string, any> = {
                      client_id: clientData.id,
                      cliente_nome: nome,
                      data_venda: new Date(lastPurchaseDate).toISOString(),
                      vendedora: row.ultimo_vendedor?.toString().trim() || '',
                      quantidade_itens: 0,
                      valor_total: deltaValue,
                      ticket_medio: ticketMedio,
                    };

                    if (supportsPurchaseCount) {
                      saleRecord.quantidade_compras = deltaPurchases;
                    }


                    await supabase
                      .from('sales')
                      .insert(saleRecord);
                        client_id: clientData.id,
                        cliente_nome: nome,
                        data_venda: new Date(lastPurchaseDate).toISOString(),
                        vendedora: row.ultimo_vendedor?.toString().trim() || '',
                        quantidade_compras: deltaPurchases,
                        quantidade_itens: 0,
                        valor_total: deltaValue,
                        ticket_medio: ticketMedio,
                      });
                  } else {
                    console.log(`Cliente ${nome}: sem delta para inserir (${deltaPurchases} compras, R$ ${deltaValue})`);
                  }
                }
              } catch (error: any) {
                console.warn(`Erro ao inserir venda para cliente ${row.cliente}:`, error.message);
              }
            }

            imported++;
          } catch (error: any) {
            console.error(`Erro ao processar linha ${i + 1}:`, error.message);
            errors++;
          }
        }

        setImportProgress({ current: 0, total: 0 });
        setStatus('success');
        setResult({ imported, errors, total: jsonData.length });
        toast({
          title: "Importação concluída!",
          description: `${imported} clientes importados de ${jsonData.length} linhas${errors > 0 ? `. ${errors} erros encontrados` : ''}`,
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

      {status === 'uploading' && importProgress.total > 0 && (
        <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
          <p className="text-muted-foreground">
            Processando: {importProgress.current} de {importProgress.total}
          </p>
          <div className="w-full bg-background rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Importações
          </h1>
          <p className="text-muted-foreground mt-2">Importe dados de planilhas Excel</p>
        </div>
        <Button 
          onClick={handleClearData} 
          disabled={isClearing}
          variant="destructive"
        >
          {isClearing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Limpando...
            </>
          ) : (
            'Limpar Todos os Dados'
          )}
        </Button>
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
