import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/AuthProvider";
import LoginPage from "./pages/LoginPage";
import ProblemsPage from "./pages/ProblemsPage";

function AppLoader() {
  return (
    <div className="grid min-h-screen place-items-center px-5">
      <p className="text-sm text-slate-600">Loading...</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/problems" replace />;
  return children;
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <AppLoader />;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/problems"
        element={
          <ProtectedRoute>
            <ProblemsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/problems" replace />} />
    </Routes>
  );
}
