import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./api/client";
import { keys } from "./api/hooks";
import { App } from "./App";
import "./index.css";

// Any 401 means the session is gone: clearing "me" sends the user to /login via ProtectedRoute.
const onError = (err: unknown) => {
  if (err instanceof ApiError && err.status === 401) queryClient.setQueryData(keys.me, null);
};

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      // Don't retry client errors (401/403/404); retry network/server errors once.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
