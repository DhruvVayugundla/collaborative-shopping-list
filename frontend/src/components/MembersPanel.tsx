import { useState } from "react";
import { useNavigate } from "react-router";
import { useAddMember, useRemoveMember } from "../api/hooks";
import { btnDanger, btnGhost, btnSecondary, card, input } from "../lib/ui";
import type { ListDetail } from "../types";
import { InlineError } from "./Feedback";

export function MembersPanel({ list, myUserId }: { list: ListDetail; myUserId: string }) {
  const [username, setUsername] = useState("");
  const add = useAddMember(list.id);
  const remove = useRemoveMember(list.id);
  const navigate = useNavigate();
  const isOwner = list.role === "owner";

  const leave = () => {
    if (!confirm(`Leave "${list.name}"? You'll lose access until the owner adds you again.`)) return;
    remove.mutate(myUserId, { onSuccess: () => navigate("/lists", { replace: true }) });
  };

  return (
    <section className={`${card} p-4`}>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Members ({list.members.length})</h2>
      <ul className="space-y-1">
        {list.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-2 text-sm">
            <span>
              @{m.username}
              {m.userId === myUserId && <span className="text-slate-400"> (you)</span>}
              {m.role === "owner" && (
                <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                  owner
                </span>
              )}
            </span>
            {isOwner && m.role !== "owner" && (
              <button
                type="button"
                className={`${btnGhost} py-1 text-xs hover:text-red-600`}
                onClick={() => remove.mutate(m.userId)}
                disabled={remove.isPending}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <InlineError error={remove.error} />

      {isOwner ? (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!username.trim()) return;
            add.mutate(username.trim(), { onSuccess: () => setUsername("") });
          }}
        >
          <div className="flex-1">
            <label htmlFor="add-member" className="sr-only">
              Username to add
            </label>
            <input
              id="add-member"
              className={input}
              placeholder="Add by username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (add.error) add.reset();
              }}
            />
            <InlineError error={add.error} />
          </div>
          <button type="submit" className={`${btnSecondary} self-start`} disabled={add.isPending || !username.trim()}>
            Add
          </button>
        </form>
      ) : (
        <button type="button" className={`${btnDanger} mt-4`} onClick={leave} disabled={remove.isPending}>
          Leave list
        </button>
      )}
    </section>
  );
}
