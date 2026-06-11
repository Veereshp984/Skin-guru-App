import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children, roles }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-4 text-ink">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-forest/20 border-t-forest" />
          <p className="text-sm text-sage">Restoring your secure session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-4 text-ink">
        <div className="max-w-md rounded-2xl border border-white/70 bg-white/85 p-8 shadow-soft text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blush/10 text-blush text-2xl">
            🚫
          </div>
          <p className="text-xs uppercase tracking-[0.28em] text-blush font-semibold">Access Denied</p>
          <h1 className="mt-2 text-xl font-semibold">This area is not available for your role.</h1>
          <p className="mt-2 text-sm text-sage">Your current role is <span className="font-medium text-ink capitalize">{user.role}</span>. Contact your administrator if you need access.</p>
          <a
            className="mt-6 inline-flex rounded-full bg-forest px-6 py-2.5 text-sm font-semibold text-white hover:-translate-y-0.5 transition"
            href="/app"
          >
            Return to App
          </a>
        </div>
      </div>
    );
  }

  return children;
}
