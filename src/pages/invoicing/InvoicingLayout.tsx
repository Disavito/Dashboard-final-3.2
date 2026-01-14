import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Receipt, NotebookPen, ClipboardList, Wallet } from 'lucide-react'; // Importar Wallet

const invoicingTabs = [
  { id: 'boletas', label: 'Emitir Boleta', icon: Receipt, path: '/invoicing/boletas' },
  { id: 'recibos', label: 'Generar Recibo de Pago', icon: Wallet, path: '/invoicing/recibos' }, // <-- NUEVA PESTAÑA
  { id: 'resumen-diario', label: 'Resúmenes y Bajas', icon: ClipboardList, path: '/invoicing/resumen-diario' },
  { id: 'facturas', label: 'Emitir Factura', icon: FileText, path: '/invoicing/facturas', disabled: true },
  { id: 'notas-credito', label: 'Notas de Crédito', icon: NotebookPen, path: '/invoicing/notas-credito', disabled: false },
];

function InvoicingLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine the active tab based on the current path
  const activeTab = invoicingTabs.find(tab => location.pathname.startsWith(tab.path))?.id || 'boletas';

  const handleTabChange = (value: string) => {
    const tab = invoicingTabs.find(t => t.id === value);
    if (tab && !tab.disabled) {
      navigate(tab.path);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-extrabold text-foreground border-b border-border pb-2">Gestión de Facturación Electrónica</h2>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-2 lg:grid-cols-5 bg-surface border border-border p-1 rounded-xl shadow-lg">
          {invoicingTabs.map((tab) => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id} 
              disabled={tab.disabled}
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <div className="mt-6">
          <Card className="bg-card border-border shadow-2xl">
            <CardContent className="p-6">
              {/* The Outlet renders the specific page (e.g., BoletasPage, ResumenDiarioPage) */}
              <Outlet />
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
}

export default InvoicingLayout;
