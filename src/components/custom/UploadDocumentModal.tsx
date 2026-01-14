import { useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UploadCloud } from 'lucide-react';

interface UploadDocumentModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  socioId: string | null; // FIX: Changed from number | null to string | null (UUID)
  socioName: string;
  documentType: 'Planos de ubicación' | 'Memoria descriptiva' | null;
  onUploadSuccess: () => void;
}

export function UploadDocumentModal({
  isOpen,
  onOpenChange,
  socioId,
  socioName,
  documentType,
  onUploadSuccess,
}: UploadDocumentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile || !socioId || !documentType) {
      toast.warning('Por favor, selecciona un archivo para subir.');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Subiendo "${documentType}"...`, {
      description: `Adjuntando archivo para ${socioName}.`,
    });

    try {
      // **DEBUGGING STEP:** Log the current session to verify authentication
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current Supabase session:', session);

      if (!session) {
        throw new Error('No hay sesión de usuario activa. Por favor, inicia sesión de nuevo.');
      }

      // 1. Determinar el bucket correcto basado en el tipo de documento
      const bucketName = documentType === 'Planos de ubicación' ? 'planos' : 'memorias'; // FIX: Changed 'memoria-descriptiva' to 'memorias' to match getBucketNameForDocumentType in PartnerDocuments.tsx

      // 2. Crear un path único para el archivo para evitar colisiones
      // Usamos el ID del socio para organizar los archivos en carpetas por socio
      const filePath = `${socioId}/${Date.now()}-${selectedFile.name}`;

      // 3. Subir el archivo al bucket de Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw new Error(`Error en Supabase Storage: ${uploadError.message}`);
      }

      // 4. Obtener la URL pública del archivo recién subido
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
      
      if (!urlData || !urlData.publicUrl) {
        throw new Error('No se pudo obtener la URL pública del archivo.');
      }
      const publicUrl = urlData.publicUrl;

      // 5. Actualizar (o insertar) el registro en la tabla socio_documentos
      // Usamos upsert para crear el registro si no existe, o actualizarlo si ya existe.
      const { error: dbError } = await supabase
        .from('socio_documentos')
        .upsert(
          {
            socio_id: socioId,
            tipo_documento: documentType,
            link_documento: publicUrl,
          },
          { onConflict: 'socio_id, tipo_documento' } // Clave única para el upsert
        );

      if (dbError) {
        throw new Error(`Error en la base de datos: ${dbError.message}`);
      }

      toast.success(`Documento subido con éxito!`, {
        id: toastId,
        description: `El archivo para ${socioName} ha sido procesado.`,
      });
      
      onUploadSuccess();
      onOpenChange(false);
      setSelectedFile(null);

    } catch (error: any) {
      console.error('Error al subir el documento:', error);
      toast.error('Error al subir el documento', {
        id: toastId,
        description: error.message || 'Ocurrió un problema con la subida. Inténtalo de nuevo.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-3">
            <UploadCloud className="h-6 w-6" />
            Subir Documento
          </DialogTitle>
          <DialogDescription className="text-textSecondary pt-1">
            Adjunta el archivo de{' '}
            <span className="font-semibold text-accent">{documentType}</span> para el socio{' '}
            <span className="font-semibold text-accent">{socioName}</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="grid w-full max-w-sm items-center gap-2">
            <Label htmlFor="document-file" className="text-text">Archivo</Label>
            <Input
              id="document-file"
              type="file"
              onChange={handleFileChange}
              className="file:text-primary file:font-semibold hover:file:bg-primary/10"
              disabled={isUploading}
            />
            {selectedFile && <p className="text-sm text-textSecondary mt-2">Archivo seleccionado: {selectedFile.name}</p>}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                'Confirmar y Subir'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
