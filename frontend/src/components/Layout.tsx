import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useLogout } from "../api/hooks";
import { useSocketConnected } from "../realtime/socket";
import { btnGhost } from "../lib/ui";
import type { User } from "../types";

export function Layout({ user, children }: { user: User; children: ReactNode }) {
  const logout = useLogout();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/lists" className="flex items-center gap-2 font-semibold text-slate-900">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white">
              🛒
            </span>
            <span>Shared Lists</span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <span className="hidden text-slate-500 sm:inline">@{user.username}</span>
            <button type="button" className={btnGhost} onClick={() => logout.mutate()} disabled={logout.isPending}>
              Log out
            </button>
          </div>
        </div>
        <ConnectionBanner />
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-32 pt-5">{children}</main>
    </div>
  );
}

/** Shown only after the connection has been down for a moment, to avoid flicker on page load. */
function ConnectionBanner() {
  const connected = useSocketConnected();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (connected) return setShow(false);
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, [connected]);

  if (!show) return null;
  return (
    <div role="status" className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
      Reconnecting… changes from others will appear once you're back online.
    </div>
  );
}
