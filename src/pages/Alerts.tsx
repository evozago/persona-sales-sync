import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Cake, MessageCircle } from "lucide-react";

export default function Alerts() {
  const { data: clients } = useQuery({
    queryKey: ["clients-birthdays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .not("data_nascimento", "is", null);

      if (error) throw error;
      return data;
    },
  });

  const getBirthdayAlerts = (daysAhead: number) => {
    if (!clients) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return clients.filter((client) => {
      if (!client.data_nascimento) return false;

      const birthDate = new Date(client.data_nascimento);
      const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(thisYearBirthday.getFullYear() + 1);
      }

      const daysUntil = differenceInDays(thisYearBirthday, today);
      return daysUntil >= 0 && daysUntil <= daysAhead;
    });
  };

  const todayBirthdays = getBirthdayAlerts(0);
  const weekBirthdays = getBirthdayAlerts(7);
  const monthBirthdays = getBirthdayAlerts(30);

  const openWhatsApp = (phone: string, name: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "");
    const message = encodeURIComponent(`Parabéns, ${name}! 🎉🎂 Feliz aniversário!`);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
  };

  const BirthdayCard = ({ client }: { client: any }) => {
    const birthDate = new Date(client.data_nascimento);
    const age = new Date().getFullYear() - birthDate.getFullYear();

    return (
      <Card className="p-6 hover:shadow-elevated transition-all">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Cake className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-lg">{client.nome}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(birthDate, "dd 'de' MMMM", { locale: ptBR })} • {age} anos
            </p>
            {client.telefone_1 && (
              <p className="text-sm text-muted-foreground mt-1">{client.telefone_1}</p>
            )}
          </div>
          {client.telefone_1 && (
            <Button
              size="sm"
              onClick={() => openWhatsApp(client.telefone_1, client.nome)}
              className="bg-gradient-to-r from-success to-emerald-500 hover:opacity-90"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Alertas de Aniversário
        </h1>
        <p className="text-muted-foreground mt-2">Nunca mais esqueça de parabenizar seus clientes</p>
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-3">
          <TabsTrigger value="today">
            Hoje ({todayBirthdays.length})
          </TabsTrigger>
          <TabsTrigger value="week">
            Próximos 7 dias ({weekBirthdays.length})
          </TabsTrigger>
          <TabsTrigger value="month">
            Próximos 30 dias ({monthBirthdays.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4 mt-6">
          {todayBirthdays.length > 0 ? (
            todayBirthdays.map((client) => <BirthdayCard key={client.id} client={client} />)
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Nenhum aniversário hoje</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="week" className="space-y-4 mt-6">
          {weekBirthdays.length > 0 ? (
            weekBirthdays.map((client) => <BirthdayCard key={client.id} client={client} />)
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Nenhum aniversário nos próximos 7 dias</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="month" className="space-y-4 mt-6">
          {monthBirthdays.length > 0 ? (
            monthBirthdays.map((client) => <BirthdayCard key={client.id} client={client} />)
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Nenhum aniversário nos próximos 30 dias</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
