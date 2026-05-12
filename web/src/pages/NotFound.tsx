import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';

export default function NotFoundPage() {
  const accessCode = useAuthStore((s) => s.accessCode);
  const homeUrl = accessCode ? '/' : '/login';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-muted">
      <div className="text-center space-y-6 max-w-sm">
        <div className="text-7xl">🔨</div>
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight">404</h1>
          <p className="text-lg font-medium">Pagina nu a fost găsită</p>
          <p className="text-sm text-muted-foreground">
            Linkul pe care l-ai accesat nu există sau a fost mutat.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild>
            <Link to={homeUrl}>
              <Home className="h-4 w-4 mr-1" />
              {accessCode ? 'Înapoi la cheltuieli' : 'Mergi la autentificare'}
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (window.history.length > 1) window.history.back();
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Înapoi
          </Button>
        </div>
      </div>
    </div>
  );
}
