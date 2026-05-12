import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import ExpenseDetailPage from './pages/ExpenseDetail';
import SettingsPage from './pages/Settings';
import AppLayout from './components/AppLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessCode = useAuthStore((s) => s.accessCode);
  if (!accessCode) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
