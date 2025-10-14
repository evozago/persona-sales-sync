import { Card } from "@/components/ui/card";
import { Users, ShoppingCart, TrendingUp, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clientsResult, salesResult] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("sales").select("valor_total, quantidade_itens"),
      ]);

      const totalSales = salesResult.data?.reduce((sum, sale) => sum + Number(sale.valor_total), 0) || 0;
      const totalItems = salesResult.data?.reduce((sum, sale) => sum + sale.quantidade_itens, 0) || 0;
      const avgTicket = salesResult.data?.length ? totalSales / salesResult.data.length : 0;

      return {
        totalClients: clientsResult.count || 0,
        totalSales: salesResult.data?.length || 0,
        totalRevenue: totalSales,
        avgTicket: avgTicket,
      };
    },
  });

  const statCards = [
    {
      title: "Total de Clientes",
      value: stats?.totalClients || 0,
      icon: Users,
      gradient: "from-primary to-primary-glow",
    },
    {
      title: "Total de Vendas",
      value: stats?.totalSales || 0,
      icon: ShoppingCart,
      gradient: "from-accent to-secondary",
    },
    {
      title: "Receita Total",
      value: `R$ ${(stats?.totalRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      gradient: "from-success to-emerald-400",
    },
    {
      title: "Ticket Médio",
      value: `R$ ${(stats?.avgTicket || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      gradient: "from-violet-500 to-purple-500",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="p-6 hover:shadow-elevated transition-all duration-300 border-border/50"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Bem-vindo!</h3>
          <p className="text-muted-foreground">
            Este é o seu sistema de gestão de vendas. Use o menu lateral para navegar entre as diferentes funcionalidades.
          </p>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Próximos Passos</h3>
          <ul className="space-y-2 text-muted-foreground">
            <li>• Importe seus clientes e vendas</li>
            <li>• Configure as vendedoras</li>
            <li>• Acompanhe o ranking de vendas</li>
            <li>• Gerencie alertas de aniversário</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
