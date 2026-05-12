import { Link, useLocation } from 'react-router-dom';
import { LogOut, Settings, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';
import { IS_MOCK } from '@/services/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onSettings = pathname === '/settings';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 h-14">
          <Link to="/" className="font-semibold tracking-tight flex items-center gap-2">
            <span className="text-primary">🏠</span>
            <span>RenoTrack</span>
            {IS_MOCK && (
              <span className="ml-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold uppercase px-1.5 py-0.5">
                POC
              </span>
            )}
          </Link>
          <nav className="flex items-center gap-1">
            {onSettings ? (
              <Button asChild variant="ghost" size="icon" aria-label="Acasă">
                <Link to="/">
                  <Home className="h-5 w-5" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="icon" aria-label="Setări">
                <Link to="/settings">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Deconectare"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-4 sm:py-6 pb-24">{children}</main>
    </div>
  );
}
