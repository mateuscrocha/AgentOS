import { useNavigate, useLocation } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function OnboardingError() {
  const navigate = useNavigate();
  const location = useLocation();
  const message = location.state?.message || 'Ocorreu um erro durante o processo de onboarding.';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/onboarding');
  };

  return (
    <PublicLayout progress={100}>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center mb-4">
            <img src="/admin-logo.png" alt="Bóris" className="w-16 h-16 rounded-xl object-cover shadow-sm ring-1 ring-border" />
          </div>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">
                Algo deu errado
              </h1>
              <p className="text-muted-foreground text-sm">
                {message}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/onboarding')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao onboarding
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PublicLayout>
  );
}
