import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AuthPage } from "./pages/AuthPage";
import { ListsPage } from "./pages/ListsPage";
import { ListDetailPage } from "./pages/ListDetailPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/lists/:listId" element={<ListDetailPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/lists" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/lists" className="text-emerald-700 hover:underline">
        Go to your lists
      </Link>
    </div>
  );
}
