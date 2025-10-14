import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientChildrenForm } from "./ClientChildrenForm";
import { ClientBrandsForm } from "./ClientBrandsForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClientEditDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientEditDialog({ clientId, open, onOpenChange }: ClientEditDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<any>({});

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      setFormData(data);
      return data;
    },
    enabled: open,
  });

  const updateClient = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("clients")
        .update(data)
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente atualizado com sucesso!");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar cliente");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateClient.mutate(formData);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="text-center py-12">Carregando...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
            <TabsTrigger value="filhos">Filhos</TabsTrigger>
            <TabsTrigger value="marcas">Marcas Preferidas</TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome || ""}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf || ""}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                  <Input
                    id="data_nascimento"
                    type="date"
                    value={formData.data_nascimento || ""}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="genero">Gênero</Label>
                  <Select
                    value={formData.genero || ""}
                    onValueChange={(value) => setFormData({ ...formData, genero: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="telefone_1">Telefone 1</Label>
                  <Input
                    id="telefone_1"
                    value={formData.telefone_1 || ""}
                    onChange={(e) => setFormData({ ...formData, telefone_1: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="telefone_2">Telefone 2</Label>
                  <Input
                    id="telefone_2"
                    value={formData.telefone_2 || ""}
                    onChange={(e) => setFormData({ ...formData, telefone_2: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="vendedora_responsavel">Vendedora Responsável</Label>
                  <Input
                    id="vendedora_responsavel"
                    value={formData.vendedora_responsavel || ""}
                    onChange={(e) => setFormData({ ...formData, vendedora_responsavel: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="observacao">Observações</Label>
                <Textarea
                  id="observacao"
                  value={formData.observacao || ""}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full">
                Salvar Alterações
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="filhos">
            <ClientChildrenForm clientId={clientId} />
          </TabsContent>

          <TabsContent value="marcas">
            <ClientBrandsForm clientId={clientId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
