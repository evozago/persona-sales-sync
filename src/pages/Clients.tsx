import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, MessageCircle } from "lucide-react";

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", searchTerm],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("nome");
      
      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,telefone_1.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const openWhatsApp = (phone: string, name: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "");
    const message = encodeURIComponent(`Olá ${name}! Tudo bem?`);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Clientes
          </h1>
          <p className="text-muted-foreground mt-2">Gerencie seus clientes</p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : clients && clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Card key={client.id} className="p-6 hover:shadow-elevated transition-all duration-300">
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{client.nome}</h3>
                  {client.cpf && <p className="text-sm text-muted-foreground">CPF: {client.cpf}</p>}
                </div>
                
                {client.telefone_1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <p className="text-sm">{client.telefone_1}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openWhatsApp(client.telefone_1!, client.nome)}
                      className="hover:bg-success/10 hover:text-success hover:border-success"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                {client.vendedora_responsavel && (
                  <p className="text-xs text-muted-foreground">
                    Vendedora: {client.vendedora_responsavel}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Nenhum cliente encontrado</p>
        </Card>
      )}
    </div>
  );
}
