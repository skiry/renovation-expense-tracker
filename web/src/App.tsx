import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import LoginPage from './pages/Login';
import UserSelectPage from './pages/UserSelect';
import DashboardPage from './pages/Dashboard';
import ExpenseDetailPage from './pages/ExpenseDetail';
import SettingsPage from './pages/Settings';
import HistoryPage from './pages/History';
import NotFoundPage from './pages/NotFound';
import SurprisePage from './pages/Surprise';
import Surprise31Page from './pages/Surprise31';
import AppLayout from './components/AppLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessCode = useAuthStore((s) => s.accessCode);
  const userId = useAuthStore((s) => s.userId);
  if (!accessCode) return <Navigate to="/login" replace />;
  if (!userId) return <Navigate to="/login/user" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function CodeOnlyRoute({ children }: { children: React.ReactNode }) {
  const accessCode = useAuthStore((s) => s.accessCode);
  if (!accessCode) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/login/user"
        element={
          <CodeOnlyRoute>
            <UserSelectPage />
          </CodeOnlyRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expense/:id"
        element={
          <ProtectedRoute>
            <ExpenseDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/surprise" element={<SurprisePage />} />
      <Route path="/surprise31" element={<Surprise31Page />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
