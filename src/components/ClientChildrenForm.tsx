import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClientChildrenFormProps {
  clientId: string;
}

export function ClientChildrenForm({ clientId }: ClientChildrenFormProps) {
  const queryClient = useQueryClient();
  const [children, setChildren] = useState<any[]>([]);

  const { data: sizes } = useQuery({
    queryKey: ["sizes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sizes").select("*").order("tipo").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { isLoading } = useQuery({
    queryKey: ["client-children", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_children")
        .select("*")
        .eq("client_id", clientId);
      if (error) throw error;
      setChildren(data || []);
      return data;
    },
  });

  const saveChildren = useMutation({
    mutationFn: async (childrenData: any[]) => {
      // Delete removed children
      const existingIds = childrenData.filter(c => c.id).map(c => c.id);
      
      if (existingIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("client_children")
          .delete()
          .eq("client_id", clientId)
          .not("id", "in", `(${existingIds.join(",")})`);
        
        if (deleteError) throw deleteError;
      } else {
        // Se não há IDs existentes, deletar todos os filhos do cliente
        const { error: deleteError } = await supabase
          .from("client_children")
          .delete()
          .eq("client_id", clientId);
        
        if (deleteError) throw deleteError;
      }

      // Update or insert children
      for (const child of childrenData) {
        if (child.id) {
          const { error } = await supabase
            .from("client_children")
            .update(child)
            .eq("id", child.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("client_children")
            .insert({ ...child, client_id: clientId });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-children"] });
      toast.success("Filhos atualizados com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar filhos");
    },
  });

  const addChild = () => {
    setChildren([...children, {
      nome: "",
      genero: "",
      data_nascimento: "",
      tamanho_roupa_id: "",
      data_registro_tamanho: new Date().toISOString().split("T")[0],
      numeracao_calcado_id: "",
      data_registro_numeracao: new Date().toISOString().split("T")[0],
    }]);
  };

  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const updateChild = (index: number, field: string, value: any) => {
    const updated = [...children];
    updated[index] = { ...updated[index], [field]: value };
    setChildren(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveChildren.mutate(children);
  };

  if (isLoading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {children.map((child, index) => (
        <Card key={index} className="p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Filho {index + 1}</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeChild(index)}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={child.nome || ""}
                onChange={(e) => updateChild(index, "nome", e.target.value)}
              />
            </div>
            <div>
              <Label>Gênero</Label>
              <Select
                value={child.genero || ""}
                onValueChange={(value) => updateChild(index, "genero", value)}
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
              <Label>Data de Nascimento</Label>
              <Input
                type="date"
                value={child.data_nascimento || ""}
                onChange={(e) => updateChild(index, "data_nascimento", e.target.value)}
              />
            </div>
            <div>
              <Label>Tamanho de Roupa</Label>
              <Select
                value={child.tamanho_roupa_id || ""}
                onValueChange={(value) => updateChild(index, "tamanho_roupa_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {sizes?.filter(s => s.tipo === "roupa").map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      {size.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Registro Tamanho</Label>
              <Input
                type="date"
                value={child.data_registro_tamanho || ""}
                onChange={(e) => updateChild(index, "data_registro_tamanho", e.target.value)}
              />
            </div>
            <div>
              <Label>Numeração de Calçado</Label>
              <Select
                value={child.numeracao_calcado_id || ""}
                onValueChange={(value) => updateChild(index, "numeracao_calcado_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {sizes?.filter(s => s.tipo === "calçado").map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      {size.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Registro Numeração</Label>
              <Input
                type="date"
                value={child.data_registro_numeracao || ""}
                onChange={(e) => updateChild(index, "data_registro_numeracao", e.target.value)}
              />
            </div>
          </div>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={addChild} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Filho
      </Button>

      {children.length > 0 && (
        <Button type="submit" className="w-full">
          Salvar Filhos
        </Button>
      )}
    </form>
  );
}
