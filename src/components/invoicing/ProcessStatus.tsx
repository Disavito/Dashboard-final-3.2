import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProcessStep = 'creating' | 'sending' | 'success' | 'error';

interface ProcessStatusProps {
  currentStep: ProcessStep;
  summaryId: number | null;
}

const Step = ({ title, description, status }: { title: string; description: string; status: 'completed' | 'in-progress' | 'pending' }) => {
  const getIcon = () => {
    if (status === 'completed') return <CheckCircle2 className="h-6 w-6 text-success" />;
    if (status === 'in-progress') return <Loader2 className="h-6 w-6 text-primary animate-spin" />;
    return <div className="h-6 w-6 rounded-full bg-border" />;
  };

  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        {getIcon()}
        <div className={cn("w-px h-8 mt-2", status === 'completed' ? 'bg-success' : 'bg-border')} />
      </div>
      <div className="pt-0.5">
        <p className={cn("font-semibold", status !== 'pending' ? 'text-text' : 'text-textSecondary')}>{title}</p>
        <p className="text-sm text-textSecondary">{description}</p>
      </div>
    </div>
  );
};

function ProcessStatus({ currentStep, summaryId }: ProcessStatusProps) {
  return (
    <div className="p-4 bg-background rounded-lg border border-border">
      <Step
        title="Paso 1: Crear Resumen Diario"
        description="Generando el archivo de resumen con las boletas del día."
        status={currentStep === 'creating' ? 'in-progress' : 'completed'}
      />
      <Step
        title="Paso 2: Enviar a SUNAT"
        description={`Enviando el resumen (ID: ${summaryId ?? '...'}) para su validación.`}
        status={currentStep === 'sending' ? 'in-progress' : (currentStep === 'creating' ? 'pending' : 'completed')}
      />
    </div>
  );
}

export default ProcessStatus;
