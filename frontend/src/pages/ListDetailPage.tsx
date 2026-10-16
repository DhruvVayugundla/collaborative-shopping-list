import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useOutletContext, useParams } from "react-router";
import { ApiError } from "../api/client";
import { useAddItem, useDeleteList, useList, useRenameList } from "../api/hooks";
import { computeTotals, sortItems } from "../api/cache";
import { useListSocket } from "../realtime/useListSocket";
import { ItemForm } from "../components/ItemForm";
import { ItemRow } from "../components/ItemRow";
import { MembersPanel } from "../components/MembersPanel";
import { ErrorMessage, InlineError, Spinner } from "../components/Feedback";
import { formatMoney } from "../lib/format";
import { btnDanger, btnGhost, btnPrimary, btnSecondary, card, input } from "../lib/ui";
import type { ListDetail, User } from "../types";

export function ListDetailPage() {
  const { listId = "" } = useParams();
  const me = useOutletContext<User>();
  const { data: list, isPending, error, refetch } = useList(listId);
  useListSocket(listId, me.id);

  if (isPending) return <Spinner />;
  if (error instanceof ApiError && error.status === 404) {
    return <Navigate to="/lists" replace state={{ notice: "That list doesn't exist or you no longer have access." }} />;
  }
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;

  return <ListView list={list} myUserId={me.id} />;
}

function ListView({ list, myUserId }: { list: ListDetail; myUserId: string }) {
  const addItem = useAddItem(list.id);
  const items = useMemo(() => sortItems(list.items), [list.items]);
  const totals = useMemo(() => computeTotals(list.items), [list.items]);

  return (
    <div className="space-y-5">
      <Link to="/lists" className="text-sm text-slate-500 hover:text-slate-800">
        ← All lists
      </Link>
      <ListHeader list={list} />

      <section className={`${card} p-3`}>
        <ItemForm
          submitLabel="Add item"
          pending={addItem.isPending}
          error={addItem.error}
          onSubmit={(v) => addItem.mutateAsync(v)}
          resetOnSuccess
        />
      </section>

      <section className={card}>
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">No items yet. Add the first one above.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      <MembersPanel list={list} myUserId={myUserId} />

      <TotalBar {...totals} count={list.items.length} />
    </div>
  );
}

function ListHeader({ list }: { list: ListDetail }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const rename = useRenameList(list.id);
  const del = useDeleteList(list.id);
  const navigate = useNavigate();
  const isOwner = list.role === "owner";

  if (editing) {
    return (
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          rename.mutate(name.trim(), { onSuccess: () => setEditing(false) });
        }}
      >
        <div className="flex-1">
          <label htmlFor="list-name" className="sr-only">
            List name
          </label>
          <input
            id="list-name"
            className={input}
            value={name}
            maxLength={100}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <InlineError error={rename.error} />
        </div>
        <button type="submit" className={`${btnPrimary} self-start`} disabled={rename.isPending}>
          Save
        </button>
        <button type="button" className={`${btnSecondary} self-start`} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <h1 className="min-w-0 break-words text-2xl font-semibold">{list.name}</h1>
      {isOwner && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              setName(list.name);
              setEditing(true);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className={btnDanger}
            disabled={del.isPending}
            onClick={() => {
              if (!confirm(`Delete "${list.name}" for everyone? This can't be undone.`)) return;
              del.mutate(undefined, { onSuccess: () => navigate("/lists", { replace: true }) });
            }}
          >
            Delete
          </button>
        </div>
      )}
      <InlineError error={del.error} />
    </div>
  );
}

function TotalBar({
  totalCents,
  pendingCents,
  purchasedCount,
  count,
}: ReturnType<typeof computeTotals> & { count: number }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3" aria-live="polite">
        <div>
          <div className="text-xs text-slate-500">Estimated total</div>
          <div className="text-xl font-semibold tabular-nums">{formatMoney(totalCents)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">
            {purchasedCount}/{count} bought · still to buy
          </div>
          <div className="text-lg font-medium tabular-nums text-emerald-700">{formatMoney(pendingCents)}</div>
        </div>
      </div>
    </div>
  );
}
