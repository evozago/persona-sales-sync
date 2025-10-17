import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

type ImportStatus = "idle" | "uploading" | "success" | "error";
type ImportType = "clients" | "sales";
type ImportResult = { imported: number; errors: number; total: number } | null;

type SpreadsheetRow = {
  cliente?: string;
  cpf_cliente?: string;
  telefone_principal?: string;
  data_aniversario_cliente?: any;
  qtde_compras_total?: any;
  qtde_compras?: any;
  quantidade_compras?: any;
  qtd_compras?: any;
  numero_compras?: any;
  numero_de_compras?: any;
  total_gasto?: any;
  ticket_medio?: any;
  data_ultima_compra?: any;
  ultimo_vendedor?: string;
  marcas_compradas?: string;
  tamanhos_comprados?: string;
  numeracao_comprados?: string;
};

type ImportProgress = { current: number; total: number };

const INITIAL_PROGRESS: ImportProgress = { current: 0, total: 0 };

const normalizeNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
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

const normalizeInteger = (value: any): number => {
  const normalized = normalizeNumber(value);
  if (!Number.isFinite(normalized)) return 0;
  const rounded = Math.round(normalized);
  return rounded > 0 ? rounded : 0;
};

const convertExcelDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const processArrayField = (field: string | null | undefined): string[] => {
  if (!field || field === "[]" || field.toLowerCase?.() === "nan") return [];

  const cleanField = String(field)
    .replace(/[\[\]]/g, "")
    .replace(/'/g, "")
    .replace(/"/g, "");

  return cleanField
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.toLowerCase() !== "nan");
};

const sanitizeBrand = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.toString().trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeClothingSize = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const cleaned = value.toString().trim();
  if (!cleaned) return null;
  return cleaned.toUpperCase();
};

const sanitizeShoeSize = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const cleaned = value.toString().trim();
  if (!cleaned) return null;

  const upper = cleaned.toUpperCase();
  const nPrefixed = upper.match(/^N[-\s]*(.+)$/);
  if (nPrefixed && nPrefixed[1]) {
    const digits = nPrefixed[1].trim().replace(/\s+/g, "");
    return `N-${digits}`;
  }

  return upper.replace(/\s+/g, "");
};

const derivePurchaseCount = (row: SpreadsheetRow, totalSpent: number): number => {
  const directCount =
    row.qtde_compras_total ??
    row.qtde_compras ??
    row.quantidade_compras ??
    row.qtd_compras ??
    row.numero_compras ??
    row.numero_de_compras ??
    0;

  let normalized = normalizeInteger(directCount);

  if (normalized === 0 && totalSpent > 0) {
    const ticketMedio = normalizeNumber(row.ticket_medio);
    if (ticketMedio > 0) {
      const derived = Math.round(totalSpent / ticketMedio);
      if (derived > 0) {
        normalized = derived;
      }
    }
  }

  return normalized;
};

export default function Imports() {
  const [clientsStatus, setClientsStatus] = useState<ImportStatus>("idle");
  const [salesStatus, setSalesStatus] = useState<ImportStatus>("idle");
  const [clientsResult, setClientsResult] = useState<ImportResult>(null);
  const [salesResult, setSalesResult] = useState<ImportResult>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>(INITIAL_PROGRESS);
  const { toast } = useToast();

  const resetProgress = () => setImportProgress(INITIAL_PROGRESS);

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await supabase.from("sales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase
        .from("client_brand_preferences")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase
        .from("client_size_preferences")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("client_children").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("clients").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("brands").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("sizes").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      toast({
        title: "Dados limpos!",
        description: "Todos os dados foram removidos com sucesso.",
      });
    } catch (error: any) {
      console.error("Clear data error:", error);
      toast({
        title: "Erro ao limpar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleFileUpload = async (file: File, type: ImportType) => {
    const setStatus = type === "clients" ? setClientsStatus : setSalesStatus;
    const setResult = type === "clients" ? setClientsResult : setSalesResult;

    setStatus("uploading");
    setResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: SpreadsheetRow[] = XLSX.utils.sheet_to_json(firstSheet);

      if (type !== "clients") {
        setStatus("success");
        setResult({ imported: 0, errors: 0, total: 0 });
        toast({
          title: "Importação de vendas",
          description: "Use a importação de clientes para importar vendas.",
        });
        return;
      }

      if (rows.length === 0) {
        setStatus("success");
        setResult({ imported: 0, errors: 0, total: 0 });
        toast({
          title: "Arquivo vazio",
          description: "Nenhuma linha encontrada na planilha.",
        });
        return;
      }

      setImportProgress({ current: 0, total: rows.length });

      // Detecta suporte à coluna quantidade_compras
      let supportsPurchaseCount = true;
      const { error: purchaseColumnError } = await supabase.from("sales").select("quantidade_compras").limit(1);
      if (purchaseColumnError?.message?.includes("quantidade_compras")) {
        console.warn("Coluna quantidade_compras não encontrada. Prosseguindo sem controle de duplicidade.");
        supportsPurchaseCount = false;
      }

      // Coletar marcas e tamanhos únicos
      const brandSet = new Set<string>();
      const clothingSizeSet = new Set<string>();
      const shoeSizeSet = new Set<string>();

      for (const row of rows) {
        processArrayField(row.marcas_compradas)
          .map(sanitizeBrand)
          .filter((marca): marca is string => Boolean(marca))
          .forEach((marca) => brandSet.add(marca));

        processArrayField(row.tamanhos_comprados)
          .map(sanitizeClothingSize)
          .filter((size): size is string => Boolean(size))
          .forEach((size) => clothingSizeSet.add(size));

        processArrayField(row.numeracao_comprados)
          .map(sanitizeShoeSize)
          .filter((size): size is string => Boolean(size))
          .forEach((size) => shoeSizeSet.add(size));
      }

      if (brandSet.size > 0) {
        const brandPayload = Array.from(brandSet).map((nome) => ({ nome }));
        await supabase
          .from("brands")
          .upsert(brandPayload, { onConflict: "nome", ignoreDuplicates: true });
      }

      const sizeInserts: { nome: string; tipo: "roupa" | "calçado" }[] = [];
      Array.from(clothingSizeSet).forEach((nome) => sizeInserts.push({ nome, tipo: "roupa" }));
      Array.from(shoeSizeSet).forEach((nome) => sizeInserts.push({ nome, tipo: "calçado" }));

      if (sizeInserts.length > 0) {
        await supabase
          .from("sizes")
          .upsert(sizeInserts, { onConflict: "nome,tipo", ignoreDuplicates: true });
      }

      const brandMap = new Map<string, string>();
      if (brandSet.size > 0) {
        const { data: brands } = await supabase
          .from("brands")
          .select("id, nome")
          .in("nome", Array.from(brandSet));
        brands?.forEach((brand) => {
          if (brand.nome) {
            brandMap.set(brand.nome, brand.id);
          }
        });
      }

      const clothingSizeMap = new Map<string, string>();
      if (clothingSizeSet.size > 0) {
        const { data: clothingSizes } = await supabase
          .from("sizes")
          .select("id, nome")
          .eq("tipo", "roupa")
          .in("nome", Array.from(clothingSizeSet));
        clothingSizes?.forEach((size) => {
          if (size.nome) {
            clothingSizeMap.set(size.nome, size.id);
          }
        });
      }

      const shoeSizeMap = new Map<string, string>();
      if (shoeSizeSet.size > 0) {
        const { data: shoeSizes } = await supabase
          .from("sizes")
          .select("id, nome")
          .eq("tipo", "calçado")
          .in("nome", Array.from(shoeSizeSet));
        shoeSizes?.forEach((size) => {
          if (size.nome) {
            shoeSizeMap.set(size.nome, size.id);
          }
        });
      }

      let imported = 0;
      let errors = 0;

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        setImportProgress({ current: index + 1, total: rows.length });

        try {
          const clientName = row.cliente?.toString().trim();
          if (!clientName) {
            errors++;
            continue;
          }

          const cpf = row.cpf_cliente?.toString().trim() || null;
          const birthDate = convertExcelDate(row.data_aniversario_cliente);
          const lastPurchaseDate = convertExcelDate(row.data_ultima_compra);
          const lastSeller = row.ultimo_vendedor?.toString().trim() || null;

          let existingClient = null;

          if (cpf) {
            const { data } = await supabase.from("clients").select("*").eq("cpf", cpf).maybeSingle();
            existingClient = data;
          }

          if (!existingClient) {
            const { data } = await supabase.from("clients").select("*").eq("nome", clientName).maybeSingle();
            existingClient = data;
          }

          let clientId: string | null = null;

          if (existingClient) {
            const { data: updatedClient, error: updateError } = await supabase
              .from("clients")
              .update({ vendedora_responsavel: lastSeller ?? existingClient.vendedora_responsavel })
              .eq("id", existingClient.id)
              .select()
              .maybeSingle();

            if (updateError) {
              throw updateError;
            }

            clientId = (updatedClient ?? existingClient)?.id ?? null;
          } else {
            const { data: insertedClient, error: insertError } = await supabase
              .from("clients")
              .insert({
                nome: clientName,
                cpf,
                telefone_1: row.telefone_principal?.toString().trim() || null,
                data_nascimento: birthDate ? birthDate.toISOString().split("T")[0] : null,
                vendedora_responsavel: lastSeller,
              })
              .select()
              .single();

            if (insertError) {
              throw insertError;
            }

            clientId = insertedClient?.id ?? null;
          }

          if (!clientId) {
            throw new Error("Não foi possível determinar o ID do cliente");
          }

          // Vincular marcas ao cliente
          const brandPreferences = Array.from(
            new Set(
              processArrayField(row.marcas_compradas)
                .map(sanitizeBrand)
                .filter((marca): marca is string => Boolean(marca))
            )
          )
            .map((marca) => {
              const brandId = brandMap.get(marca);
              return brandId ? { client_id: clientId!, brand_id: brandId } : null;
            })
            .filter((entry): entry is { client_id: string; brand_id: string } => Boolean(entry));

          if (brandPreferences.length > 0) {
            await supabase
              .from("client_brand_preferences")
              .upsert(brandPreferences, {
                onConflict: "client_id,brand_id",
                ignoreDuplicates: true,
              });
          }

          // Vincular tamanhos de roupa e calçado
          const clothingPreferences = Array.from(
            new Set(
              processArrayField(row.tamanhos_comprados)
                .map(sanitizeClothingSize)
                .filter((size): size is string => Boolean(size))
            )
          )
            .map((size) => {
              const sizeId = clothingSizeMap.get(size);
              return sizeId ? { client_id: clientId!, size_id: sizeId } : null;
            })
            .filter((entry): entry is { client_id: string; size_id: string } => Boolean(entry));

          const shoePreferences = Array.from(
            new Set(
              processArrayField(row.numeracao_comprados)
                .map(sanitizeShoeSize)
                .filter((size): size is string => Boolean(size))
            )
          )
            .map((size) => {
              const sizeId = shoeSizeMap.get(size);
              return sizeId ? { client_id: clientId!, size_id: sizeId } : null;
            })
            .filter((entry): entry is { client_id: string; size_id: string } => Boolean(entry));

          const sizePreferences = [...clothingPreferences, ...shoePreferences];

          if (sizePreferences.length > 0) {
            await supabase
              .from("client_size_preferences")
              .upsert(sizePreferences, {
                onConflict: "client_id,size_id",
                ignoreDuplicates: true,
              });
          }

          // Processar resumo de vendas
          const totalSpent = normalizeNumber(row.total_gasto);
          const purchaseCount = derivePurchaseCount(row, totalSpent);

          if (totalSpent > 0 && purchaseCount > 0 && lastPurchaseDate) {
            const selectColumns = supportsPurchaseCount ? "quantidade_compras, valor_total" : "valor_total";
            const { data: existingSales, error: salesError } = await supabase
              .from("sales")
              .select(selectColumns)
              .eq("client_id", clientId);

            if (salesError && !salesError.message?.includes("quantidade_compras")) {
              throw salesError;
            }

            const existingPurchaseTotal = supportsPurchaseCount
              ? existingSales?.reduce((sum, sale) => sum + (sale.quantidade_compras ?? 0), 0) ?? 0
              : 0;
            const existingValueTotal = existingSales?.reduce((sum, sale) => sum + Number(sale.valor_total ?? 0), 0) ?? 0;

            const deltaPurchases = purchaseCount - existingPurchaseTotal;
            const deltaValue = totalSpent - existingValueTotal;

            if (deltaPurchases > 0 && deltaValue > 0) {
              const ticketMedio = deltaValue / deltaPurchases;
              const saleRecord: Record<string, any> = {
                client_id: clientId,
                cliente_nome: clientName,
                data_venda: new Date(lastPurchaseDate).toISOString(),
                vendedora: lastSeller ?? "",
                quantidade_itens: 0,
                valor_total: deltaValue,
                ticket_medio: ticketMedio,
              };

              if (supportsPurchaseCount) {
                saleRecord.quantidade_compras = deltaPurchases;
              }

              await supabase.from("sales").insert(saleRecord);
            }
          }

          imported++;
        } catch (error: any) {
          console.error(`Erro ao processar linha ${index + 1}:`, error?.message ?? error);
          errors++;
        }
      }

      resetProgress();
      setStatus("success");
      const result = { imported, errors, total: rows.length };
      setResult(result);
      toast({
        title: "Importação concluída!",
        description: `${imported} clientes importados de ${rows.length} linhas${
          errors > 0 ? `. ${errors} erros encontrados` : ""
        }`,
      });
    } catch (error: any) {
      console.error("Import error:", error);
      setStatus("error");
      toast({
        title: "Erro na importação",
        description: error?.message ?? "Ocorreu um erro ao processar o arquivo.",
        variant: "destructive",
      });
    } finally {
      resetProgress();
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
    result: ImportResult;
    onFileSelect: (file: File) => void;
    gradient: string;
  }) => (
    <Card className="p-8 text-center space-y-4 hover:shadow-elevated transition-all">
      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} mx-auto flex items-center justify-center`}>
        {status === "uploading" ? (
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        ) : status === "success" ? (
          <CheckCircle className="w-8 h-8 text-white" />
        ) : status === "error" ? (
          <AlertCircle className="w-8 h-8 text-white" />
        ) : (
          <Upload className="w-8 h-8 text-white" />
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
      </div>

      {status === "uploading" && importProgress.total > 0 && (
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
          {result.errors > 0 && <p className="text-destructive">✗ {result.errors} erros</p>}
          <p className="text-muted-foreground">Total: {result.total} linhas</p>
        </div>
      )}

      <div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          id={`file-${title}`}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFileSelect(file);
          }}
          disabled={status === "uploading"}
        />
        <Button
          onClick={() => document.getElementById(`file-${title}`)?.click()}
          disabled={status === "uploading"}
          className={`bg-gradient-to-r ${gradient} hover:opacity-90`}
        >
          {status === "uploading" ? (
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Importações
          </h1>
          <p className="text-muted-foreground mt-2">Importe dados de planilhas Excel</p>
        </div>
        <Button onClick={handleClearData} disabled={isClearing} variant="destructive">
          {isClearing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Limpando...
            </>
          ) : (
            "Limpar Todos os Dados"
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ImportCard
          title="Importar Clientes"
          description="Faça upload da planilha unificada"
          status={clientsStatus}
          result={clientsResult}
          onFileSelect={(uploadedFile) => handleFileUpload(uploadedFile, "clients")}
          gradient="from-primary to-primary-glow"
        />

        <ImportCard
          title="Importar Vendas"
          description="Não disponível - use importação de clientes"
          status={salesStatus}
          result={salesResult}
          onFileSelect={(uploadedFile) => handleFileUpload(uploadedFile, "sales")}
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
              <li>• marcas_compradas, tamanhos_comprados (roupas), numeracao_comprados (calçados)</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-foreground mb-1">🏷️ Formato de Arrays:</p>
            <ul className="space-y-1 ml-4">
              <li>• Arrays devem estar no formato: ['ITEM1', 'ITEM2']</li>
              <li>• marcas_compradas → cria e vincula marcas ao cliente</li>
              <li>• tamanhos_comprados → registra tamanhos de roupas do cliente</li>
              <li>• numeracao_comprados → valores como N-36, N-38 serão associados como calçados</li>
            </ul>
          </div>

          <div className="pt-3 border-t border-border">
            <p className="font-medium text-foreground mb-1">⚠️ Observações:</p>
            <ul className="space-y-1 ml-4">
              <li>• Cada cliente é atualizado ou criado com marcas, tamanhos e resumo de compras</li>
              <li>• Quantidades de compras faltantes são derivadas pelo ticket médio quando possível</li>
              <li>• Marcas e tamanhos inexistentes são criados automaticamente e vinculados</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
