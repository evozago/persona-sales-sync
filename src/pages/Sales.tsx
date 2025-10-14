import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Sales() {
  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("data_venda", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Vendas
        </h1>
        <p className="text-muted-foreground mt-2">Histórico de vendas</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : sales && sales.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left p-4 font-semibold">Cliente</th>
                  <th className="text-left p-4 font-semibold">Data</th>
                  <th className="text-left p-4 font-semibold">Vendedora</th>
                  <th className="text-right p-4 font-semibold">Itens</th>
                  <th className="text-right p-4 font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-4">{sale.cliente_nome}</td>
                    <td className="p-4 text-muted-foreground">
                      {format(new Date(sale.data_venda), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="p-4 text-muted-foreground">{sale.vendedora}</td>
                    <td className="p-4 text-right">{sale.quantidade_itens}</td>
                    <td className="p-4 text-right font-semibold text-success">
                      R$ {Number(sale.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Nenhuma venda registrada</p>
        </Card>
      )}
    </div>
  );
}
