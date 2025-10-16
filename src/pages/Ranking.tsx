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
  const [sort, setSort] = useState<{ key: 'nome' | 'total' | 'lastPurchase' | 'days' | 'phone'; dir: 'asc' | 'desc' }>({ key: 'total', dir: 'desc' });

  const { data: saleswomenStats, isLoading } = useQuery({
    queryKey: ["saleswomen-ranking"],
    queryFn: async () => {
      const { data: sales } = await supabase
        .from("sales")
        .select("vendedora, valor_total, cliente_nome");

      if (!sales) return [];

      const statsMap = new Map<
        string,
        {
          total: number;
          count: number;
          clients: Map<string, { total: number; count: number }>;
        }
      >();

      sales.forEach((sale) => {
        const valor = Number(sale.valor_total);
        const stats =
          statsMap.get(sale.vendedora) ||
          {
            total: 0,
            count: 0,
            clients: new Map<string, { total: number; count: number }>(),
          };

        stats.total += valor;
        stats.count += 1;

        const clientStats = stats.clients.get(sale.cliente_nome) || { total: 0, count: 0 };
        clientStats.total += valor;
        clientStats.count += 1;
        stats.clients.set(sale.cliente_nome, clientStats);

        statsMap.set(sale.vendedora, stats);
      });

      return Array.from(statsMap.entries())
        .map(([nome, stats]) => {
          const clientStats = Array.from(stats.clients.values());
          const clientesUnicos = clientStats.length;
          const totalTicketMedio = clientStats.reduce((sum, client) => sum + client.total / client.count, 0);

          return {
            nome,
            totalVendas: stats.total,
            quantidadeVendas: stats.count,
            clientesUnicos,
            ticketMedio: clientesUnicos > 0 ? totalTicketMedio / clientesUnicos : 0,
          };
        })
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

      const clientsMap = new Map<string, { total: number; lastPurchase: Date; clientId: string | null }>();

      for (const sale of sales) {
        const current = clientsMap.get(sale.cliente_nome);
        const saleDate = new Date(sale.data_venda);
        
        if (!current) {
          clientsMap.set(sale.cliente_nome, {
            total: Number(sale.valor_total),            total: Number(sale.valor_total),
            lastPurchase: saleDate,
            clientId: sale.client_id || null,
          });
        } else {
          current.total += Number(sale.valor_total);
          if (saleDate > current.lastPurchase) {
            current.lastPurchase = saleDate;
          }
          if (sale.client_id && !current.clientId) {
            current.clientId = sale.client_id;
          }
        }
      }

      const uniqueClientNames = Array.from(clientsMap.keys());
      
      const { data: clientsInfo } = await supabase
        .from("clients")
        .select("nome, telefone_1")
        .in("nome", uniqueClientNames);

      const phoneMap = new Map<string, string>();
      clientsInfo?.forEach(client => {
        if (client.telefone_1) {
          phoneMap.set(client.nome, client.telefone_1);
        }
      });

      return Array.from(clientsMap.entries())
        .map(([nome, data]) => ({
          nome,
          total: data.total,
          lastPurchase: data.lastPurchase,
          daysSinceLastPurchase: Math.floor((Date.now() - data.lastPurchase.getTime()) / (1000 * 60 * 60 * 24)),
          phone: phoneMap.get(nome) || null,
        }))
        .sort((a, b) => b.total - a.total);
    },
    enabled: !!expandedSaleswoman,
  });

  const sortedClients = clientsData
    ? [...clientsData].sort((a, b) => {
        let va: any;
        let vb: any;
        switch (sort.key) {
          case 'nome':
            va = a.nome?.toLowerCase() || '';
            vb = b.nome?.toLowerCase() || '';
            break;
          case 'total':
            va = a.total || 0;
            vb = b.total || 0;
            break;
          case 'lastPurchase':
            va = a.lastPurchase ? new Date(a.lastPurchase).getTime() : 0;
            vb = b.lastPurchase ? new Date(b.lastPurchase).getTime() : 0;
            break;
          case 'days':
            va = a.daysSinceLastPurchase || 0;
            vb = b.daysSinceLastPurchase || 0;
            break;
          case 'phone':
            va = a.phone ? 1 : 0;
            vb = b.phone ? 1 : 0;
            break;
          default:
            va = 0; vb = 0;
        }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sort.dir === 'asc' ? cmp : -cmp;
      })
    : null;

  const toggleSort = (key: 'nome' | 'total' | 'lastPurchase' | 'days' | 'phone') => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const getMessageTemplate = (saleswomanName: string) => {
    return messageTemplates[saleswomanName] || 
      `Olá {NOME}! 😊\n\nTudo bem? Notei que faz {DIAS} dias que você não faz uma comprinha conosco e estou com saudades!\n\nTenho algumas novidades incríveis que sei que você vai adorar. Que tal darmos uma olhadinha?\n\nEstou aqui para te ajudar! 💖`;
  };

  const normalizeBRPhone = (raw: string) => {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) return null;
    
    let n = digits.replace(/^0+/, '');
    
    // Se já tem código do país (55)
    if (n.startsWith('55') && n.length >= 12 && n.length <= 13) return n;
    
    // Se é número brasileiro sem código do país (10 ou 11 dígitos)
    if (n.length >= 10 && n.length <= 11) return '55' + n;
    
    // Se tem 12 ou 13 dígitos sem 55, assume que é válido
    if (n.length >= 12 && n.length <= 13) return n;
    
    return null;
  };

  const isMobile = () => /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

  const sanitizeWhatsAppMessage = (text: string) => {
    let t = (text as string);
    try { t = t.normalize?.('NFKC') ?? t; } catch { /* ignore */ }
    // Remove surrogate pairs (incl. emojis) to avoid encoding issues that can trigger blocking
    t = t.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
    // Normalize newlines
    t = t.replace(/\r\n|\r/g, '\n').trim();
    return t;
  };

  const handleWhatsAppClick = (clientName: string, phone: string | null, daysSince: number, saleswomanName: string) => {
    if (!phone) {
      toast.error("Cliente não possui telefone cadastrado");
      return;
    }

    const normalized = normalizeBRPhone(phone);
    if (!normalized) {
      toast.error("Telefone inválido para WhatsApp");
      return;
    }

    const template = getMessageTemplate(saleswomanName);
    const message = sanitizeWhatsAppMessage(
      template
        .replace("{NOME}", clientName)
        .replace("{DIAS}", daysSince.toString())
    );

    const encoded = encodeURIComponent(message);
    // Use deep link on mobile and Web WhatsApp on desktop to avoid api.whatsapp.com blocking in iframes
    const url = isMobile()
      ? `whatsapp://send?phone=${normalized}&text=${encoded}`
      : `https://web.whatsapp.com/send?phone=${normalized}&text=${encoded}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };
  const getRankColor = (index: number) => {
    if (index === 0) return "from-yellow-400 to-yellow-600";
    if (index === 1) return "from-gray-300 to-gray-500";
    if (index === 2) return "from-amber-600 to-amber-800";
    return "from-primary to-accent";
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Ranking de Vendedoras
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">Desempenho por vendedora</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : saleswomenStats && saleswomenStats.length > 0 ? (
        <div className="space-y-4">
          {saleswomenStats.map((saleswoman, index) => (
            <Card
              key={saleswoman.nome}
              className="p-4 md:p-6 hover:shadow-elevated transition-all duration-300"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                <div
                  className={`w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${getRankColor(index)} flex items-center justify-center shadow-lg flex-shrink-0`}
                >
                  <span className="text-xl md:text-2xl font-bold text-white">#{index + 1}</span>
                </div>

                <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-xs md:text-sm text-muted-foreground">Vendedora</p>
                    <p className="font-semibold text-base md:text-lg truncate">{saleswoman.nome}</p>
                  </div>

                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Total Vendido</p>
                    <p className="font-semibold text-success text-sm md:text-lg">
                      R$ {saleswoman.totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">Vendas</p>
                    <p className="font-semibold text-sm md:text-lg">{saleswoman.quantidadeVendas}</p>
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <p className="text-xs md:text-sm text-muted-foreground">Ticket Médio</p>
                    <p className="font-semibold text-sm md:text-lg">
                      R$ {saleswoman.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full md:w-auto hover:bg-primary/10 hover:text-primary hover:border-primary text-xs md:text-sm"
                  onClick={() => setExpandedSaleswoman(expandedSaleswoman === saleswoman.nome ? null : saleswoman.nome)}
                >
                  {expandedSaleswoman === saleswoman.nome ? (
                    <>
                      <ChevronUp className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                      <span className="hidden sm:inline">Ocultar</span>
                      <span className="sm:hidden">Fechar</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                      <span className="hidden sm:inline">Ver Clientes</span>
                      <span className="sm:hidden">Clientes</span>
                    </>
                  )}
                </Button>
              </div>

              {expandedSaleswoman === saleswoman.nome && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs md:text-sm font-medium">Mensagem WhatsApp (use {"{NOME}"} e {"{DIAS}"})</label>
                    <Textarea
                      value={getMessageTemplate(saleswoman.nome)}
                      onChange={(e) => setMessageTemplates({ ...messageTemplates, [saleswoman.nome]: e.target.value })}
                      className="min-h-[100px] text-sm"
                    />
                  </div>

                  {clientsData ? (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead onClick={() => toggleSort('nome')} className="cursor-pointer select-none text-xs md:text-sm whitespace-nowrap">
                              Cliente {sort.key==='nome' && (sort.dir==='asc' ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />)}
                            </TableHead>
                            <TableHead onClick={() => toggleSort('total')} className="cursor-pointer select-none text-xs md:text-sm whitespace-nowrap">
                              Total {sort.key==='total' && (sort.dir==='asc' ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />)}
                            </TableHead>
                            <TableHead onClick={() => toggleSort('lastPurchase')} className="cursor-pointer select-none text-xs md:text-sm whitespace-nowrap hidden md:table-cell">
                              Última Compra {sort.key==='lastPurchase' && (sort.dir==='asc' ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />)}
                            </TableHead>
                            <TableHead onClick={() => toggleSort('days')} className="cursor-pointer select-none text-xs md:text-sm whitespace-nowrap">
                              Dias {sort.key==='days' && (sort.dir==='asc' ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />)}
                            </TableHead>
                            <TableHead onClick={() => toggleSort('phone')} className="cursor-pointer select-none text-xs md:text-sm whitespace-nowrap">
                              WhatsApp {sort.key==='phone' && (sort.dir==='asc' ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />)}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(sortedClients || clientsData)?.map((client) => (
                            <TableRow key={client.nome}>
                              <TableCell className="font-medium text-xs md:text-sm">{client.nome}</TableCell>
                              <TableCell className="text-success text-xs md:text-sm whitespace-nowrap">
                                R$ {client.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-xs md:text-sm hidden md:table-cell">
                                {client.lastPurchase.toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell className="text-xs md:text-sm">
                                <span className={client.daysSinceLastPurchase > 90 ? "text-destructive font-semibold" : ""}>
                                  {client.daysSinceLastPurchase}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleWhatsAppClick(client.nome, client.phone, client.daysSinceLastPurchase, saleswoman.nome)}
                                  disabled={!client.phone}
                                  className="hover:bg-success/10 hover:text-success hover:border-success p-1 md:p-2"
                                >
                                  <MessageCircle className="w-3 h-3 md:w-4 md:h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
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
