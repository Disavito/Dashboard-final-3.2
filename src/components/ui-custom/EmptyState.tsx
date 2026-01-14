import React from 'react';
import { LucideIcon, FileText } from 'lucide-react';

interface EmptyStateProps {
  Icon?: LucideIcon;
  title: string;
  description: string;
  actionButton?: React.ReactNode;
}

/**
 * Componente de Estado Vacío (Empty State)
 * Muestra un mensaje visualmente atractivo cuando no hay datos en una tabla o lista.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  Icon = FileText, // Icono por defecto
  title,
  description,
  actionButton,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center h-full min-h-[300px] bg-surface/50 rounded-xl border border-dashed border-border/70 transition-all duration-300 hover:border-primary/50">
      <div className="p-4 rounded-full bg-primary/10 text-primary mb-4">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-textSecondary max-w-md mb-6">{description}</p>
      {actionButton && (
        <div className="mt-4">
          {actionButton}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
