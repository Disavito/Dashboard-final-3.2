import BoletaForm from '@/components/invoicing/BoletaForm';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function BoletasPage() {
  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <CardTitle className="text-2xl font-bold text-primary">Emisión de Boleta de Venta Electrónica</CardTitle>
        <CardDescription className="text-textSecondary">
          Complete los datos del cliente y los detalles de la venta para generar y enviar la boleta a la SUNAT.
        </CardDescription>
      </CardHeader>
      
      <BoletaForm />
    </div>
  );
}

export default BoletasPage;
