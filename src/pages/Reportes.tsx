import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const ReportesPage = () => {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Reportes</h1>
        <p className="mt-1 text-muted-foreground">
          Visualiza y exporta los reportes de tu negocio.
        </p>
      </header>
      
      <Card className="rounded-xl border-border bg-surface shadow-lg">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-xl font-semibold text-foreground">Página de Reportes</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-muted-foreground">El contenido para la página de reportes se implementará aquí.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportesPage;
