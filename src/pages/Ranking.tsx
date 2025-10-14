import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, TrendingUp } from "lucide-react";

export default function Ranking() {
  const { data: saleswomenStats, isLoading } = useQuery({
    queryKey: ["saleswomen-ranking"],
    queryFn: async () => {
      const { data: sales } = await supabase
        .from("sales")
        .select("vendedora, valor_total, cliente_nome");

      if (!sales) return [];

      const statsMap = new Map<string, { total: number; count: number; clients: Set<string> }>();

      sales.forEach((sale) => {
        const current = statsMap.get(sale.vendedora) || { total: 0, count: 0, clients: new Set() };
        current.total += Number(sale.valor_total);
        current.count += 1;
        current.clients.add(sale.cliente_nome);
        statsMap.set(sale.vendedora, current);
      });

      return Array.from(statsMap.entries())
        .map(([nome, stats]) => ({
          nome,
          totalVendas: stats.total,
          quantidadeVendas: stats.count,
          clientesUnicos: stats.clients.size,
          ticketMedio: stats.total / stats.count,
        }))
        .sort((a, b) => b.totalVendas - a.totalVendas);
    },
  });

  const getRankColor = (index: number) => {
    if (index === 0) return "from-yellow-400 to-yellow-600";
    if (index === 1) return "from-gray-300 to-gray-500";
    if (index === 2) return "from-amber-600 to-amber-800";
    return "from-primary to-accent";
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Ranking de Vendedoras
        </h1>
        <p className="text-muted-foreground mt-2">Desempenho por vendedora</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : saleswomenStats && saleswomenStats.length > 0 ? (
        <div className="space-y-4">
          {saleswomenStats.map((saleswoman, index) => (
            <Card
              key={saleswoman.nome}
              className="p-6 hover:shadow-elevated transition-all duration-300"
            >
              <div className="flex items-center gap-6">
                <div
                  className={`w-16 h-16 rounded-full bg-gradient-to-br ${getRankColor(index)} flex items-center justify-center shadow-lg flex-shrink-0`}
                >
                  <span className="text-2xl font-bold text-white">#{index + 1}</span>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vendedora</p>
                    <p className="font-semibold text-lg">{saleswoman.nome}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Total Vendido</p>
                    <p className="font-semibold text-success text-lg">
                      R$ {saleswoman.totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Vendas</p>
                    <p className="font-semibold text-lg">{saleswoman.quantidadeVendas}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Ticket Médio</p>
                    <p className="font-semibold text-lg">
                      R$ {saleswoman.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="hover:bg-primary/10 hover:text-primary hover:border-primary"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Detalhes
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Nenhuma venda registrada ainda</p>
        </Card>
      )}
    </div>
  );
}
