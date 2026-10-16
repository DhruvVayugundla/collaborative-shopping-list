import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useCreateList, useLists } from "../api/hooks";
import { ErrorMessage, InlineError, Spinner } from "../components/Feedback";
import { formatMoney } from "../lib/format";
import { btnPrimary, card, input } from "../lib/ui";
import type { ListSummary } from "../types";

export function ListsPage() {
  const { data: lists, isPending, error, refetch } = useLists();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;

  const mine = lists?.filter((l) => l.role === "owner") ?? [];
  const shared = lists?.filter((l) => l.role !== "owner") ?? [];

  return (
    <div className="space-y-6">
      {notice && (
        <div role="status" className="rounded-lg bg-sky-50 px-4 py-2 text-sm text-sky-900">
          {notice}
        </div>
      )}
      <NewListForm />

      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <Section title="My lists" lists={mine} empty="You haven't created a list yet. Start one above." />
          <Section title="Shared with me" lists={shared} empty="When someone adds you to their list, it shows up here." />
        </>
      )}
    </div>
  );
}

function NewListForm() {
  const [name, setName] = useState("");
  const create = useCreateList();
  const navigate = useNavigate();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        create.mutate(name.trim(), {
          onSuccess: ({ list }) => {
            setName("");
            navigate(`/lists/${list.id}`);
          },
        });
      }}
    >
      <div className="flex-1">
        <label htmlFor="new-list" className="sr-only">
          New list name
        </label>
        <input
          id="new-list"
          className={input}
          placeholder="New list, e.g. Weekly groceries"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <InlineError error={create.error} />
      </div>
      <button type="submit" className={`${btnPrimary} self-start`} disabled={create.isPending || !name.trim()}>
        Create
      </button>
    </form>
  );
}

function Section({ title, lists, empty }: { title: string; lists: ListSummary[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {lists.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {lists.map((l) => (
            <li key={l.id}>
              <ListCard list={l} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ListCard({ list }: { list: ListSummary }) {
  const progress = list.itemCount === 0 ? 0 : (list.purchasedCount / list.itemCount) * 100;
  return (
    <Link to={`/lists/${list.id}`} className={`${card} block p-4 transition hover:border-emerald-300 hover:shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{list.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {list.role === "owner" ? "You" : `@${list.owner.username}`} ·{" "}
            {list.memberCount} {list.memberCount === 1 ? "member" : "members"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold tabular-nums">{formatMoney(list.totalCents)}</div>
          <div className="text-xs text-slate-500">
            {list.purchasedCount}/{list.itemCount} bought
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}
