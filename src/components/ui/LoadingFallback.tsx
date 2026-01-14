import { LoaderCircle } from 'lucide-react';

const LoadingFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
      <p className="text-lg text-muted-foreground">Cargando...</p>
    </div>
  </div>
);

export default LoadingFallback;
