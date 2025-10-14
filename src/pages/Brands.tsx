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

export default function Brands() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);
  const [brandName, setBrandName] = useState("");
  const queryClient = useQueryClient();

  const { data: brands, isLoading } = useQuery({
    queryKey: ["brands", searchTerm],
    queryFn: async () => {
      let query = supabase.from("brands").select("*").order("nome");
      
      if (searchTerm) {
        query = query.ilike("nome", `%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createBrand = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("brands").insert({ nome });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Marca criada com sucesso!");
      setIsAddDialogOpen(false);
      setBrandName("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar marca");
    },
  });

  const updateBrand = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("brands").update({ nome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Marca atualizada com sucesso!");
      setEditingBrand(null);
      setBrandName("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar marca");
    },
  });

  const deleteBrand = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Marca excluída com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao excluir marca");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) {
      toast.error("Digite o nome da marca");
      return;
    }
    
    if (editingBrand) {
      updateBrand.mutate({ id: editingBrand.id, nome: brandName });
    } else {
      createBrand.mutate(brandName);
    }
  };

  const handleEdit = (brand: any) => {
    setEditingBrand(brand);
    setBrandName(brand.nome);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Marcas de Produtos
          </h1>
          <p className="text-muted-foreground mt-2">Gerencie as marcas disponíveis</p>
        </div>
        <Dialog open={isAddDialogOpen || !!editingBrand} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingBrand(null);
            setBrandName("");
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Nova Marca
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBrand ? "Editar Marca" : "Nova Marca"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome da Marca</Label>
                <Input
                  id="nome"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Digite o nome da marca"
                />
              </div>
              <Button type="submit" className="w-full">
                {editingBrand ? "Atualizar" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Buscar marcas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : brands && brands.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => (
            <Card key={brand.id} className="p-6 hover:shadow-elevated transition-all duration-300">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{brand.nome}</h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(brand)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Deseja realmente excluir a marca ${brand.nome}?`)) {
                        deleteBrand.mutate(brand.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Nenhuma marca encontrada</p>
        </Card>
      )}
    </div>
  );
}
