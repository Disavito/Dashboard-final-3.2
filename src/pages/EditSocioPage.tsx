import { useParams } from 'react-router-dom';
import SocioTitularRegistrationForm from '@/components/custom/SocioTitularRegistrationForm';
import SocioStatusAndDocuments from '@/components/custom/SocioStatusAndDocuments';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Importación de componentes Tabs

function EditSocioPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="min-h-screen bg-background text-text font-sans flex items-center justify-center">
        <p className="text-destructive text-lg">Error: ID de socio no proporcionado para edición.</p>
      </div>
    );
  }

  // Función de éxito dummy para forzar recarga si es necesario
  const handleSuccess = () => {
    // Aquí se podría implementar una lógica de recarga o notificación global
    console.log("Operación exitosa en el formulario principal.");
  };

  return (
    <div className="min-h-screen bg-background text-text font-sans">
      <header className="relative h-64 md:h-80 lg:h-96 flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary to-secondary shadow-lg">
        <img
          src="https://images.pexels.com/photos/3184433/pexels-photo-3184433.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
          alt="Community building"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="relative z-10 text-center p-4">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white drop-shadow-lg leading-tight">
            Editar Titular
          </h1>
          <p className="mt-2 text-lg md:text-xl text-white text-opacity-90 max-w-2xl mx-auto">
            Actualiza la información del socio existente.
          </p>
        </div>
      </header>
      <main className="py-12 max-w-6xl mx-auto px-4">
        
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-surface border border-border shadow-lg">
            <TabsTrigger 
              value="general" 
              className="text-lg font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
            >
              Datos Generales y Vivienda
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="text-lg font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
            >
              Documentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            <div className="bg-surface p-6 rounded-xl shadow-2xl border border-border">
              <h2 className="text-2xl font-bold text-primary border-b border-border pb-3 mb-6">
                Información Personal y de Vivienda
              </h2>
              <SocioTitularRegistrationForm socioId={id} onClose={() => {}} onSuccess={handleSuccess} />
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <SocioStatusAndDocuments socioId={id} />
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
}

export default EditSocioPage;
