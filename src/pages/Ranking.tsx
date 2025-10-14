import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Ranking() {
  const [expandedSaleswoman, setExpandedSaleswoman] = useState<string | null>(null);
  const [messageTemplates, setMessageTemplates] = useState<Record<string, string>>({});

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

  const { data: clientsData } = useQuery({
    queryKey: ["saleswoman-clients", expandedSaleswoman],
    queryFn: async () => {
      if (!expandedSaleswoman) return null;

      const { data: sales } = await supabase
        .from("sales")
        .select("cliente_nome, valor_total, data_venda, client_id")
        .eq("vendedora", expandedSaleswoman);

      if (!sales) return null;

      const clientsMap = new Map<string, { total: number; lastPurchase: Date; phone: string | null; clientId: string | null }>();

      for (const sale of sales) {
        const current = clientsMap.get(sale.cliente_nome);
        const saleDate = new Date(sale.data_venda);
        
        if (!current || saleDate > current.lastPurchase) {
          clientsMap.set(sale.cliente_nome, {
            total: (current?.total || 0) + Number(sale.valor_total),
            lastPurchase: current && saleDate < current.lastPurchase ? current.lastPurchase : saleDate,
            phone: current?.phone || null,
            clientId: sale.client_id || current?.clientId || null,
          });
        } else {
          clientsMap.set(sale.cliente_nome, {
            ...current,
            total: current.total + Number(sale.valor_total),
          });
        }
      }

      const clientIds = Array.from(clientsMap.values())
        .map(c => c.clientId)
        .filter(Boolean);

      if (clientIds.length > 0) {
        const { data: clientsInfo } = await supabase
          .from("clients")
          .select("id, telefone_1")
          .in("id", clientIds);

        clientsInfo?.forEach(client => {
          const entry = Array.from(clientsMap.entries()).find(([_, v]) => v.clientId === client.id);
          if (entry) {
            entry[1].phone = client.telefone_1;
          }
        });
      }

      return Array.from(clientsMap.entries())
        .map(([nome, data]) => ({
          nome,
          total: data.total,
          lastPurchase: data.lastPurchase,
          daysSinceLastPurchase: Math.floor((Date.now() - data.lastPurchase.getTime()) / (1000 * 60 * 60 * 24)),
          phone: data.phone,
        }))
        .sort((a, b) => b.total - a.total);
    },
    enabled: !!expandedSaleswoman,
  });

  const getMessageTemplate = (saleswomanName: string) => {
    return messageTemplates[saleswomanName] || 
      `Olá {NOME}! 😊\n\nTudo bem? Notei que faz {DIAS} dias que você não faz uma comprinha conosco e estou com saudades!\n\nTenho algumas novidades incríveis que sei que você vai adorar. Que tal darmos uma olhadinha?\n\nEstou aqui para te ajudar! 💖`;
  };

  const handleWhatsAppClick = (clientName: string, phone: string | null, daysSince: number, saleswomanName: string) => {
    if (!phone) {
      toast.error("Cliente não possui telefone cadastrado");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const template = getMessageTemplate(saleswomanName);
    const message = template
      .replace("{NOME}", clientName)
      .replace("{DIAS}", daysSince.toString());
    
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

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
                  onClick={() => setExpandedSaleswoman(expandedSaleswoman === saleswoman.nome ? null : saleswoman.nome)}
                >
                  {expandedSaleswoman === saleswoman.nome ? (
                    <ChevronUp className="w-4 h-4 mr-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 mr-2" />
                  )}
                  {expandedSaleswoman === saleswoman.nome ? "Ocultar" : "Ver Clientes"}
                </Button>
              </div>

              {expandedSaleswoman === saleswoman.nome && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mensagem WhatsApp (use {"{NOME}"} e {"{DIAS}"})</label>
                    <Textarea
                      value={getMessageTemplate(saleswoman.nome)}
                      onChange={(e) => setMessageTemplates({ ...messageTemplates, [saleswoman.nome]: e.target.value })}
                      className="min-h-[100px]"
                    />
                  </div>

                  {clientsData ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Total Comprado</TableHead>
                            <TableHead>Última Compra</TableHead>
                            <TableHead>Dias sem Comprar</TableHead>
                            <TableHead>WhatsApp</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientsData.map((client) => (
                            <TableRow key={client.nome}>
                              <TableCell className="font-medium">{client.nome}</TableCell>
                              <TableCell className="text-success">
                                R$ {client.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                {client.lastPurchase.toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell>
                                <span className={client.daysSinceLastPurchase > 90 ? "text-destructive font-semibold" : ""}>
                                  {client.daysSinceLastPurchase} dias
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleWhatsAppClick(client.nome, client.phone, client.daysSinceLastPurchase, saleswoman.nome)}
                                  disabled={!client.phone}
                                  className="hover:bg-success/10 hover:text-success hover:border-success"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      Carregando clientes...
                    </div>
                  )}
                </div>
              )}
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
