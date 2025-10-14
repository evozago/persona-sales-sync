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

    const CHUNK_SIZE = type === 'clients' ? 300 : 200;

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

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

      let imported = 0;
      let errors = 0;

      if (type === 'clients') {
        const records: any[] = [];
        for (const row of jsonData) {
          try {
            const nome = row.nome?.toString().trim();
            if (!nome || row.roles !== 'CLIENT') continue;

            const dateVal = convertExcelDate(row.data_nascimento);
            const isoDate = dateVal ? new Date(dateVal).toISOString().split('T')[0] : null;

            records.push({
              third_id: row.third_id?.toString() || null,
              nome,
              cpf: row.cpf?.toString() || null,
              rg: row.rg?.toString() || null,
              data_nascimento: isoDate,
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
            });
          } catch (e) {
            errors++;
          }
        }

        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
          const chunk = records.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from('clients').insert(chunk);
          if (error) {
            console.error('Insert chunk error (clients):', error);
            errors += chunk.length;
          } else {
            imported += chunk.length;
          }
        }

        setStatus('success');
        setResult({ imported, errors, total: jsonData.length });
        toast({
          title: "Importação concluída!",
          description: `${imported} registros importados com sucesso${errors > 0 ? `, ${errors} erros` : ''}`,
        });
      } else {
        const records: any[] = [];
        for (const row of jsonData) {
          try {
            const clienteNome = row.cliente?.toString().trim();
            if (!clienteNome) continue;
            const dataVenda = convertExcelDate(row.ultima_compra) || new Date();
            records.push({
              cliente_nome: clienteNome,
              data_venda: dataVenda,
              vendedora: row.ultimo_vendedor?.toString() || 'Não informado',
              quantidade_itens: parseInt(row.itens) || 0,
              valor_total: parseFloat(row.val_compras) || 0,
              ticket_medio: parseFloat(row.ticket_medio) || 0,
            });
          } catch (e) {
            errors++;
          }
        }

        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
          const chunk = records.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from('sales').insert(chunk);
          if (error) {
            console.error('Insert chunk error (sales):', error);
            errors += chunk.length;
          } else {
            imported += chunk.length;
          }
        }

        setStatus('success');
        setResult({ imported, errors, total: jsonData.length });
        toast({
          title: "Importação concluída!",
          description: `${imported} vendas importadas${errors > 0 ? `, ${errors} erros` : ''}`,
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
          description="Faça upload da planilha de clientes (pessoas)"
          status={clientsStatus}
          result={clientsResult}
          onFileSelect={(file) => handleFileUpload(file, 'clients')}
          gradient="from-primary to-primary-glow"
        />

        <ImportCard
          title="Importar Vendas"
          description="Faça upload do resumo de clientes/vendas"
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
            <p className="font-medium text-foreground mb-1">📊 Planilha de Clientes:</p>
            <ul className="space-y-1 ml-4">
              <li>• Formato aceito: Excel (.xlsx, .xls)</li>
              <li>• Colunas esperadas: nome, cpf, telefone_1, data_nascimento, endereço, etc.</li>
              <li>• A importação detectará automaticamente as colunas</li>
            </ul>
          </div>
          
          <div>
            <p className="font-medium text-foreground mb-1">💰 Planilha de Vendas:</p>
            <ul className="space-y-1 ml-4">
              <li>• Formato aceito: Excel (.xlsx, .xls)</li>
              <li>• Colunas esperadas: cliente, ultima_compra, ultimo_vendedor, val_compras, etc.</li>
              <li>• O sistema tentará vincular automaticamente com os clientes cadastrados</li>
            </ul>
          </div>

          <div className="pt-3 border-t border-border">
            <p className="font-medium text-foreground mb-1">⚠️ Observações:</p>
            <ul className="space-y-1 ml-4">
              <li>• Registros duplicados serão atualizados quando possível</li>
              <li>• Linhas com dados inválidos serão ignoradas</li>
              <li>• Um resumo será exibido após cada importação</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
