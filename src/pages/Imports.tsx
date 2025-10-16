        title: "Dados limpos!",
        description: "Todos os dados foram removidos com sucesso.",
      });
    } catch (error: any) {
      console.error('Clear data error:', error);
      toast({
        title: "Erro ao limpar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleFileUpload = async (
    file: File,
    type: 'clients' | 'sales'
  ) => {
    const setStatus = type === 'clients' ? setClientsStatus : setSalesStatus;
    const setResult = type === 'clients' ? setClientsResult : setSalesResult;

    setStatus('uploading');
    setResult(null);

    const normalizeNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const sanitized = value
          .replace(/\s+/g, '')
          .replace(/\./g, '')
          .replace(/,/g, '.');
        const parsed = parseFloat(sanitized);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const normalizeInteger = (value: any): number => {
      const num = normalizeNumber(value);
      if (!Number.isFinite(num)) return 0;
      const rounded = Math.round(num);
      return rounded > 0 ? rounded : 0;
    };

    const convertExcelDate = (value: any) => {
      if (!value) return null;
      if (value instanceof Date) return value;
      if (typeof value === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + value * 86400000);
      }
      if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    };

    const processArrayField = (field: string | null | undefined): string[] => {
      if (!field || field === '[]' || field === 'nan') return [];
      
      // Converter para string e remover colchetes e aspas
      const cleanField = String(field)
        .replace(/[\[\]]/g, '')  // Remove colchetes
        .replace(/'/g, '')        // Remove aspas simples
        .replace(/"/g, '');       // Remove aspas duplas
      
      // Separar por vírgula e limpar
      return cleanField
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0 && item !== 'nan');
    };

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

      let imported = 0;
      let errors = 0;

      if (type === 'clients') {
        let supportsPurchaseCount = true;
        const { error: purchaseColumnError } = await supabase
          .from('sales')
          .select('quantidade_compras')
          .limit(1);

        if (purchaseColumnError && purchaseColumnError.message?.includes('quantidade_compras')) {
          console.warn('Coluna quantidade_compras não encontrada. Prosseguindo sem controle de duplicidade.');
          supportsPurchaseCount = false;
        }

