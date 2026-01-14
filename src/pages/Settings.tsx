import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon } from 'lucide-react';

const SettingsPage: React.FC = () => {
  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <SettingsIcon className="w-10 h-10 text-primary" />
        <h1 className="text-4xl font-bold text-foreground">Configuración</h1>
      </div>
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle>Configuración de la Aplicación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-textSecondary">
            Esta sección está en desarrollo. Aquí podrás gestionar las configuraciones generales de la aplicación, perfiles de usuario y más.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
