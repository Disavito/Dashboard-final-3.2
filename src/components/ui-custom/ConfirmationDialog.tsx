import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  data: Record<string, any>; // Data to display in the summary
  confirmButtonText?: string;
  isConfirming?: boolean; // To show loading state on confirm button
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  data,
  confirmButtonText = 'Confirmar Registro',
  isConfirming = false,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {Object.entries(data).map(([key, value]) => {
            // Skip null or undefined values for cleaner display, unless it's a critical field
            if (value === null || value === undefined || value === '') {
              return null;
            }

            // Format key for better readability (e.g., "receipt_number" -> "Nº Recibo")
            const formattedKey = key
              .replace(/([A-Z])/g, ' $1') // Add space before capital letters
              .replace(/_/g, ' ') // Replace underscores with spaces
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
              .join(' ');

            let displayValue = value;
            if (typeof value === 'number' && key === 'amount') {
              displayValue = new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
              }).format(value);
            } else if (key.includes('fecha') && typeof value === 'string') {
              // Assuming date is in YYYY-MM-DD or DD/MM/YYYY format
              try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  displayValue = new Intl.DateTimeFormat('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }).format(date);
                }
              } catch (e) {
                // Fallback to original value if date parsing fails
              }
            }

            return (
              <div key={key} className="grid grid-cols-3 items-center gap-4">
                <Label className="col-span-1 text-right text-textSecondary font-medium">
                  {formattedKey}:
                </Label>
                <span className="col-span-2 text-foreground break-words">
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-lg border-border hover:bg-muted/50 transition-all duration-300"
            disabled={isConfirming}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300"
            disabled={isConfirming}
          >
            {isConfirming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              confirmButtonText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmationDialog;
