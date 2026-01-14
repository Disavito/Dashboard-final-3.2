import React from 'react';
import { FileText, FileImage, File, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DocumentLinkPillProps {
  type: string;
  link: string;
  isAdmin?: boolean; // New prop
  onDelete?: () => void; // New prop, now a simple callback
}

const DocumentLinkPill: React.FC<DocumentLinkPillProps> = ({ type, link, isAdmin, onDelete }) => {
  const getIcon = (documentType: string) => {
    switch (documentType) {
      case 'Planos de ubicación':
        return <FileImage className="h-4 w-4" />;
      case 'Memoria descriptiva':
        return <FileText className="h-4 w-4" />;
      case 'Ficha':
        return <FileText className="h-4 w-4" />;
      case 'Contrato':
        return <FileText className="h-4 w-4" />;
      case 'Comprobante de Pago':
        return <FileText className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const isDeletable = isAdmin && (type === 'Planos de ubicación' || type === 'Memoria descriptiva');

  return (
    <div className="flex items-center gap-1 bg-muted/30 text-text rounded-full pr-2 pl-3 py-1 text-sm border border-border/50 group hover:bg-muted/50 transition-colors duration-200">
      <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
        {getIcon(type)}
        <span className="truncate max-w-[120px]">{type}</span>
      </a>
      {isDeletable && onDelete && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-textSecondary hover:text-destructive hover:bg-destructive/10 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault(); // Prevent navigation
                  onDelete(); // Call the pre-configured onDelete handler
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-card text-foreground border-border">
              <p>Eliminar documento</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

export default DocumentLinkPill;
