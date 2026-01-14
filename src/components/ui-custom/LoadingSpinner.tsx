import { Loader2 } from 'lucide-react';

const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-primary">
      <Loader2 className="h-10 w-10 animate-spin" />
      <span className="ml-3 text-lg">Cargando...</span>
    </div>
  );
};

export default LoadingSpinner;
