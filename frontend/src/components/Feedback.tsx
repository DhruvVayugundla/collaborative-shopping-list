import { errorMessage } from "../api/client";
import { btnSecondary } from "../lib/ui";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner />
    </div>
  );
}

export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-center">
      <p className="text-sm text-red-800">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className={`${btnSecondary} mt-3`} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-red-600">
      {typeof error === "string" ? error : errorMessage(error)}
    </p>
  );
}
