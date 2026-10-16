import { useState } from "react";
import { useDeleteItem, useUpdateItem } from "../api/hooks";
import { centsToInput, formatMoney } from "../lib/format";
import { btnGhost } from "../lib/ui";
import type { Item } from "../types";
import { ItemForm } from "./ItemForm";
import { InlineError } from "./Feedback";

export function ItemRow({ item }: { item: Item }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateItem(item.listId);
  const remove = useDeleteItem(item.listId);

  if (editing) {
    return (
      <li className="bg-slate-50 p-3">
        <ItemForm
          submitLabel="Save"
          initial={{ name: item.name, quantity: String(item.quantity), price: centsToInput(item.estimatedPriceCents) }}
          pending={update.isPending}
          error={update.error}
          onSubmit={(v) => update.mutateAsync({ id: item.id, ...v }).then(() => setEditing(false))}
          onCancel={() => {
            update.reset();
            setEditing(false);
          }}
        />
      </li>
    );
  }

  const lineTotal = item.quantity * item.estimatedPriceCents;
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 cursor-pointer accent-emerald-600"
        checked={item.purchased}
        onChange={(e) => update.mutate({ id: item.id, purchased: e.target.checked })}
        aria-label={`Mark ${item.name} as ${item.purchased ? "pending" : "purchased"}`}
      />
      <div className="min-w-0 flex-1">
        <div className={`truncate ${item.purchased ? "text-slate-400 line-through" : ""}`}>
          {item.name}
          {item.quantity > 1 && <span className="ml-1.5 text-sm text-slate-500">×{item.quantity}</span>}
        </div>
        <div className="text-xs text-slate-400">
          {item.estimatedPriceCents > 0 && item.quantity > 1 && `${formatMoney(item.estimatedPriceCents)} each · `}
          added by @{item.createdBy.username}
        </div>
        <InlineError error={update.error ?? remove.error} />
      </div>
      <div className={`shrink-0 text-sm tabular-nums ${item.purchased ? "text-slate-400" : "text-slate-700"}`}>
        {lineTotal > 0 ? formatMoney(lineTotal) : "—"}
      </div>
      <div className="flex shrink-0">
        <button type="button" className={btnGhost} onClick={() => setEditing(true)} aria-label={`Edit ${item.name}`}>
          ✎
        </button>
        <button
          type="button"
          className={`${btnGhost} hover:text-red-600`}
          onClick={() => remove.mutate(item.id)}
          disabled={remove.isPending}
          aria-label={`Remove ${item.name}`}
        >
          ✕
        </button>
      </div>
    </li>
  );
}
