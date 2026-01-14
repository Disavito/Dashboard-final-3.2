import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const AuthPage: React.FC = () => {
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate('/'); // Redirect to dashboard on successful login
      }
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignIn) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Inicio de sesión exitoso. Redirigiendo...');
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Registro exitoso. Por favor, revisa tu correo para verificar tu cuenta.');
        setIsSignIn(true); // Switch to sign-in after successful sign-up
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 animate-fade-in">
      <Card className="w-full max-w-md bg-surface border-border shadow-xl rounded-xl overflow-hidden">
        <CardHeader className="text-center p-6 bg-card border-b border-border">
          <CardTitle className="text-3xl font-extrabold text-primary mb-2">
            {isSignIn ? 'Bienvenido de nuevo' : 'Únete a FinDash'}
          </CardTitle>
          <CardDescription className="text-textSecondary text-md">
            {isSignIn ? 'Inicia sesión para acceder a tu dashboard.' : 'Crea una cuenta para empezar a gestionar tus finanzas.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text font-semibold">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-border text-text focus:border-primary focus:ring-primary rounded-lg transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-text font-semibold">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border text-text focus:border-primary focus:ring-primary rounded-lg transition-all duration-200"
              />
            </div>
            {error && (
              <p className="text-error text-sm text-center animate-fade-in-up">
                {error}
              </p>
            )}
            {message && (
              <p className="text-success text-sm text-center animate-fade-in-up">
                {message}
              </p>
            )}
            <Button
              type="submit"
              className={cn(
                "w-full py-3 text-lg font-bold rounded-lg transition-all duration-300",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                loading && "opacity-70 cursor-not-allowed"
              )}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                isSignIn ? 'Iniciar Sesión' : 'Registrarse'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center p-6 border-t border-border bg-card">
          <Button
            variant="link"
            onClick={() => setIsSignIn(!isSignIn)}
            className="text-textSecondary hover:text-primary transition-colors duration-200 text-md"
          >
            {isSignIn ? '¿No tienes una cuenta? Regístrate' : '¿Ya tienes una cuenta? Inicia Sesión'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AuthPage;
