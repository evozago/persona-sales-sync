import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Check } from "lucide-react";

interface ClientBrandsFormProps {
  clientId: string;
}

export function ClientBrandsForm({ clientId }: ClientBrandsFormProps) {
  const queryClient = useQueryClient();
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { isLoading } = useQuery({
    queryKey: ["client-brands", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_brand_preferences")
        .select("brand_id")
        .eq("client_id", clientId);
      if (error) throw error;
      setSelectedBrands(new Set(data.map(b => b.brand_id)));
      return data;
    },
  });

  const saveBrands = useMutation({
    mutationFn: async (brandIds: string[]) => {
      // Delete all existing preferences
      await supabase
        .from("client_brand_preferences")
        .delete()
        .eq("client_id", clientId);

      // Insert new preferences
      if (brandIds.length > 0) {
        const { error } = await supabase
          .from("client_brand_preferences")
          .insert(brandIds.map(brand_id => ({ client_id: clientId, brand_id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-brands"] });
      toast.success("Marcas preferidas atualizadas!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar marcas");
    },
  });

  const toggleBrand = (brandId: string) => {
    const newSelected = new Set(selectedBrands);
    if (newSelected.has(brandId)) {
      newSelected.delete(brandId);
    } else {
      newSelected.add(brandId);
    }
    setSelectedBrands(newSelected);
  };

  const handleSubmit = () => {
    saveBrands.mutate(Array.from(selectedBrands));
  };

  if (isLoading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {brands?.map((brand) => (
          <Card
            key={brand.id}
            className={`p-4 cursor-pointer transition-all ${
              selectedBrands.has(brand.id)
                ? "bg-primary/10 border-primary"
                : "hover:bg-muted"
            }`}
            onClick={() => toggleBrand(brand.id)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{brand.nome}</span>
              {selectedBrands.has(brand.id) && (
                <Check className="w-5 h-5 text-primary" />
              )}
            </div>
          </Card>
        ))}
      </div>

      {brands && brands.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Nenhuma marca cadastrada. Cadastre marcas na página de Marcas.
        </p>
      )}

      <Button onClick={handleSubmit} className="w-full">
        Salvar Marcas Preferidas
      </Button>
    </div>
  );
}
