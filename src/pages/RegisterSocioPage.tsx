// import React from 'react'; // Eliminado, no es necesario con el nuevo JSX transform
import SocioTitularRegistrationForm from '@/components/custom/SocioTitularRegistrationForm';
// import { User } from 'lucide-react'; // Eliminado, no se usa directamente

function RegisterSocioPage() {
  // Funciones dummy para onClose y onSuccess, ya que esta página no gestiona el cierre de un diálogo
  const handleClose = () => {
    console.log('Formulario cerrado (en RegisterSocioPage)');
    // Aquí podrías redirigir al usuario o hacer otra acción si esta página fuera un formulario independiente
  };

  const handleSuccess = () => {
    console.log('Formulario enviado con éxito (en RegisterSocioPage)');
    // Aquí podrías mostrar un mensaje de éxito o redirigir
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
            Registro de Titular
          </h1>
          <p className="mt-2 text-lg md:text-xl text-white text-opacity-90 max-w-2xl mx-auto">
            Únete a nuestra comunidad. Completa el formulario para ser parte de nuestro programa.
          </p>
        </div>
      </header>
      <main className="py-12">
        <SocioTitularRegistrationForm onClose={handleClose} onSuccess={handleSuccess} />
      </main>
    </div>
  );
}

export default RegisterSocioPage;
