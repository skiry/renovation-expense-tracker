import { Link, useLocation } from 'react-router-dom';
import { LogOut, Settings, Home, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';
import { IS_MOCK } from '@/services/api';
import { usePushNotifications } from '@/hooks/usePushNotifications';

/** Runs the push hook globally inside the protected layout so that the
 * auto-resubscribe effect fires whenever the user switches workspace/user. */
function PushAutoResubscribe() {
  usePushNotifications();
  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const logout = useAuthStore((s) => s.logout);
  const userName = useAuthStore((s) => s.userName);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onDashboard = pathname === '/';
  const onSettings = pathname === '/settings';
  const onHistory = pathname === '/history';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 h-14 gap-2">
          <Link to="/" className="font-semibold tracking-tight flex items-center gap-2 min-w-0">
            <span className="text-primary">🏠</span>
            <span className="truncate">RenoTrack</span>
            {IS_MOCK && (
              <span className="ml-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold uppercase px-1.5 py-0.5">
                POC
              </span>
            )}
          </Link>
          <nav className="flex items-center gap-1 shrink-0">
            {userName && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
                <User className="h-3.5 w-3.5" />
                {userName}
              </span>
            )}
            {!onHistory && (
              <Button asChild variant="ghost" size="icon" aria-label="Istoric">
                <Link to="/history">
                  <Clock className="h-5 w-5" />
                </Link>
              </Button>
            )}
            {!onSettings && (
              <Button asChild variant="ghost" size="icon" aria-label="Setări">
                <Link to="/settings">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
            )}
            {!onDashboard && (
              <Button asChild variant="ghost" size="icon" aria-label="Acasă">
                <Link to="/">
                  <Home className="h-5 w-5" />
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
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-4 sm:py-6 pb-24">
        <PushAutoResubscribe />
        {children}
      </main>
    </div>
  );
}
