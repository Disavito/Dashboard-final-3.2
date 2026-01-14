import NotaCreditoForm from '@/components/invoicing/NotaCreditoForm';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function NotasCreditoPage() {
  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <CardTitle className="text-2xl font-bold text-primary">Emisión de Nota de Crédito Electrónica</CardTitle>
        <CardDescription className="text-textSecondary">
          Busque el comprobante a modificar, seleccione el motivo y emita la nota de crédito correspondiente.
        </CardDescription>
      </CardHeader>
      
      <NotaCreditoForm />
    </div>
  );
}

export default NotasCreditoPage;
