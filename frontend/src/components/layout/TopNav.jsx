import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { BrandMark } from "../icons/AppIcons";
import { SITE_NAME } from "../../constants/content";

const ROLE_DASHBOARD = {
  patient: "/patient",
  doctor: "/doctor",
  admin: "/admin",
};

const ROLE_BADGE_COLORS = {
  patient: "bg-lime/20 text-forest",
  doctor: "bg-mint/40 text-forest",
  admin: "bg-blush/20 text-blush",
};

function UserAvatar({ user }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.full_name}
        className="h-8 w-8 rounded-full object-cover ring-2 ring-forest/20"
      />
    );
  }
  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-xs font-bold text-white ring-2 ring-forest/20">
      {initials}
    </div>
  );
}

export function TopNav({ navItems, imageFile, fileSizeLabel, onOpenFilePicker }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isAppPage = location.pathname === "/app";

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
      setMenuOpen(false);
    }
  }

  return (
    <div className="sticky top-4 z-30 animate-rise pb-4 lg:pb-6">
      <nav className="flex items-center justify-between gap-3 rounded-full border border-white/75 bg-white/72 px-4 py-3 shadow-soft backdrop-blur-2xl sm:px-5">
        {/* Brand */}
        <Link to={user ? "/app" : "/"} className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime text-forest shadow-halo">
            <BrandMark />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-[0.3em] text-sage">{SITE_NAME}</p>
            <p className="truncate text-sm font-medium text-ink/72">AI skin screening flow</p>
          </div>
        </Link>

        {/* Authenticated nav links */}
        {user && (
          <div className="hidden items-center gap-1 lg:flex">
            <Link
              to="/app"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                location.pathname === "/app"
                  ? "bg-forest/10 text-forest"
                  : "text-ink/68 hover:bg-white hover:text-ink"
              }`}
            >
              Scan
            </Link>
            <Link
              to="/scanner"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                location.pathname === "/scanner"
                  ? "bg-forest/10 text-forest"
                  : "text-ink/68 hover:bg-white hover:text-ink"
              }`}
            >
              Live Scan
            </Link>
            <Link
              to="/reports"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                location.pathname === "/reports" || location.pathname === "/history"
                  ? "bg-forest/10 text-forest"
                  : "text-ink/68 hover:bg-white hover:text-ink"
              }`}
            >
              Reports
            </Link>
            {ROLE_DASHBOARD[user.role] && (
              <Link
                to={ROLE_DASHBOARD[user.role]}
                className={`rounded-full px-4 py-2 text-sm font-medium transition capitalize ${
                  location.pathname === ROLE_DASHBOARD[user.role]
                    ? "bg-forest/10 text-forest"
                    : "text-ink/68 hover:bg-white hover:text-ink"
                }`}
              >
                Dashboard
              </Link>
            )}
            <Link
              to="/profile"
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                location.pathname === "/profile"
                  ? "bg-forest/10 text-forest"
                  : "text-ink/68 hover:bg-white hover:text-ink"
              }`}
            >
              Profile
            </Link>
            {navItems && isAppPage &&
              navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-ink/68 transition hover:bg-white hover:text-ink"
                >
                  {item.label}
                </a>
              ))}
          </div>
        )}

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Upload file size badge – only on app page */}
          {isAppPage && imageFile ? (
            <span className="hidden rounded-full bg-[#eef3ea] px-4 py-2 text-sm text-sage sm:inline-flex">
              {fileSizeLabel}
            </span>
          ) : null}

          {/* Upload button – only on app page */}
          {isAppPage && onOpenFilePicker && (
            <button
              type="button"
              onClick={onOpenFilePicker}
              className="rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              Upload image
            </button>
          )}

          {/* User menu (authenticated) */}
          {user ? (
            <div className="relative">
              <button
                id="user-menu-btn"
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-white"
              >
                <UserAvatar user={user} />
                <span className="hidden max-w-[100px] truncate sm:block">{user.full_name.split(" ")[0]}</span>
                <span
                  className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-flex ${
                    ROLE_BADGE_COLORS[user.role] || "bg-sand text-sage"
                  }`}
                >
                  {user.role}
                </span>
                <svg className="h-3 w-3 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-white/70 bg-paper/95 p-1 shadow-soft backdrop-blur-xl">
                    <div className="px-3 py-2 border-b border-line mb-1">
                      <p className="text-sm font-semibold text-ink truncate">{user.full_name}</p>
                      <p className="text-xs text-sage truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/app"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-sand transition"
                    >
                      🔬 <span>Skin Scan</span>
                    </Link>
                    <Link
                      to="/scanner"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-sand transition"
                    >
                      📷 <span>Live Scanner</span>
                    </Link>
                    <Link
                      to="/reports"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-sand transition"
                    >
                      📜 <span>Medical Reports</span>
                    </Link>
                    {ROLE_DASHBOARD[user.role] && (
                      <Link
                        to={ROLE_DASHBOARD[user.role]}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-sand transition capitalize"
                      >
                        📊 <span>{user.role} Dashboard</span>
                      </Link>
                    )}
                    <Link
                      to="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-sand transition"
                    >
                      👤 <span>My Profile</span>
                    </Link>
                    <div className="my-1 border-t border-line" />
                    <button
                      id="logout-btn"
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-blush hover:bg-blush/10 transition disabled:opacity-60"
                    >
                      {isLoggingOut ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blush/30 border-t-blush" />
                      ) : (
                        "🚪"
                      )}
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Not authenticated */
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-ink/68 transition hover:bg-white hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
