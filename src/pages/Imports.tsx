import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function Imports() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Importações
        </h1>
        <p className="text-muted-foreground mt-2">Importe dados de planilhas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-8 text-center space-y-4 hover:shadow-elevated transition-all">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-glow mx-auto flex items-center justify-center">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Importar Clientes</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Faça upload de planilhas com dados de clientes
            </p>
          </div>
          <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
            Selecionar Arquivo
          </Button>
        </Card>

        <Card className="p-8 text-center space-y-4 hover:shadow-elevated transition-all">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-secondary mx-auto flex items-center justify-center">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Importar Vendas</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Faça upload de planilhas com histórico de vendas
            </p>
          </div>
          <Button className="bg-gradient-to-r from-accent to-secondary hover:opacity-90">
            Selecionar Arquivo
          </Button>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Instruções</h3>
        <ul className="space-y-2 text-muted-foreground">
          <li>• As planilhas devem estar no formato Excel (.xlsx) ou CSV</li>
          <li>• Certifique-se de que as colunas estão no formato correto</li>
          <li>• Downloads de templates estarão disponíveis em breve</li>
          <li>• Dados duplicados serão identificados automaticamente</li>
        </ul>
      </Card>
    </div>
  );
}
