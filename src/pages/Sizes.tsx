import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Sizes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<any>(null);
  const [sizeName, setSizeName] = useState("");
  const [sizeType, setSizeType] = useState<"roupa" | "calçado">("roupa");
  const [activeTab, setActiveTab] = useState("roupa");
  const queryClient = useQueryClient();

  const { data: sizes, isLoading } = useQuery({
    queryKey: ["sizes", activeTab, searchTerm],
    queryFn: async () => {
      let query = supabase.from("sizes").select("*").eq("tipo", activeTab).order("nome");
      
      if (searchTerm) {
        query = query.ilike("nome", `%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createSize = useMutation({
    mutationFn: async ({ nome, tipo }: { nome: string; tipo: string }) => {
      const { error } = await supabase.from("sizes").insert({ nome, tipo });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sizes"] });
      toast.success("Tamanho criado com sucesso!");
      setIsAddDialogOpen(false);
      setSizeName("");
      setSizeType("roupa");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar tamanho");
    },
  });

  const updateSize = useMutation({
    mutationFn: async ({ id, nome, tipo }: { id: string; nome: string; tipo: string }) => {
      const { error } = await supabase.from("sizes").update({ nome, tipo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sizes"] });
      toast.success("Tamanho atualizado com sucesso!");
      setEditingSize(null);
      setSizeName("");
      setSizeType("roupa");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar tamanho");
    },
  });

  const deleteSize = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sizes"] });
      toast.success("Tamanho excluído com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao excluir tamanho");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeName.trim()) {
      toast.error("Digite o tamanho");
      return;
    }
    
    if (editingSize) {
      updateSize.mutate({ id: editingSize.id, nome: sizeName, tipo: sizeType });
    } else {
      createSize.mutate({ nome: sizeName, tipo: sizeType });
    }
  };

  const handleEdit = (size: any) => {
    setEditingSize(size);
    setSizeName(size.nome);
    setSizeType(size.tipo);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Tamanhos e Numerações
          </h1>
          <p className="text-muted-foreground mt-2">Gerencie tamanhos de roupas e calçados</p>
        </div>
        <Dialog open={isAddDialogOpen || !!editingSize} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingSize(null);
            setSizeName("");
            setSizeType("roupa");
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Novo Tamanho
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSize ? "Editar Tamanho" : "Novo Tamanho"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={sizeType} onValueChange={(value: "roupa" | "calçado") => setSizeType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roupa">Roupa</SelectItem>
                    <SelectItem value="calçado">Calçado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="nome">Tamanho/Numeração</Label>
                <Input
                  id="nome"
                  value={sizeName}
                  onChange={(e) => setSizeName(e.target.value)}
                  placeholder="Ex: P, M, G, 36, 38, etc."
                />
              </div>
              <Button type="submit" className="w-full">
                {editingSize ? "Atualizar" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="roupa">Roupas</TabsTrigger>
          <TabsTrigger value="calçado">Calçados</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card className="p-4">
            <Input
              placeholder="Buscar tamanhos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Card>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : sizes && sizes.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {sizes.map((size) => (
                <Card key={size.id} className="p-4 hover:shadow-elevated transition-all duration-300">
                  <div className="space-y-2">
                    <div className="text-center">
                      <h3 className="font-bold text-2xl">{size.nome}</h3>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(size)}
                        className="flex-1"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(`Deseja realmente excluir o tamanho ${size.nome}?`)) {
                            deleteSize.mutate(size.id);
                          }
                        }}
                        className="flex-1"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Nenhum tamanho encontrado</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
