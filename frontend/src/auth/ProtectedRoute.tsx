import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { keys, useMe } from "../api/hooks";
import { socket } from "../realtime/socket";
import { Layout } from "../components/Layout";
import { FullPageSpinner, ErrorMessage } from "../components/Feedback";

/** Gate for signed-in pages. Owns the socket connection and the "my lists changed" signal. */
export function ProtectedRoute() {
  const { data: user, isPending, error, refetch } = useMe();
  const location = useLocation();
  const qc = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    const onListsChanged = () => qc.invalidateQueries({ queryKey: keys.lists });
    // A rejected handshake means the session expired: treat as logged out.
    const onConnectError = (err: Error) => {
      if (err.message === "UNAUTHENTICATED") qc.setQueryData(keys.me, null);
    };
    socket.on("lists:changed", onListsChanged);
    socket.on("connect_error", onConnectError);
    socket.connect();
    return () => {
      socket.off("lists:changed", onListsChanged);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, [userId, qc]);

  if (isPending) return <FullPageSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <Layout user={user}>
      <Outlet context={user} />
    </Layout>
  );
}
