import { useId, useState } from "react";
import { useAddItemsBulk, useParseItems } from "../api/hooks";
import { centsToInput, parseMoney } from "../lib/format";
import { btnGhost, btnPrimary, btnSecondary, input } from "../lib/ui";
import { InlineError } from "./Feedback";

const MAX_CHARS = 2000;

interface DraftRow {
  key: number;
  name: string;
  quantity: string;
  price: string;
}

/** AI quick-add: paste free text, review the parsed items, then add them all at once. */
export function QuickAddPanel({ listId, onDone }: { listId: string; onDone: () => void }) {
  const textId = useId();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const parse = useParseItems(listId);
  const addAll = useAddItemsBulk(listId);

  const runParse = () =>
    parse.mutate(text, {
      onSuccess: (items) =>
        setRows(
          items.map((d, key) => ({
            key,
            name: d.name,
            quantity: String(d.quantity),
            price: centsToInput(d.estimatedPriceCents),
          })),
        ),
    });

  const editRow = (key: number, patch: Partial<DraftRow>) =>
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? rs);

  const invalidRow = rows?.find(
    (r) => !r.name.trim() || !/^[1-9]\d{0,3}$/.test(r.quantity) || parseMoney(r.price) === null,
  );

  const submit = () => {
    if (!rows || invalidRow) return;
    addAll.mutate(
      rows.map((r) => ({
        name: r.name.trim(),
        quantity: Number(r.quantity),
        estimatedPriceCents: parseMoney(r.price) ?? 0,
      })),
      { onSuccess: onDone },
    );
  };

  if (rows === null) {
    return (
      <div className="space-y-2">
        <label htmlFor={textId} className="text-sm font-medium text-slate-700">
          Paste or type your list
        </label>
        <textarea
          id={textId}
          className={`${input} min-h-28 resize-y`}
          placeholder={"2kg rice, a dozen eggs, milk\nsurf excel ~250\nbread x2"}
          maxLength={MAX_CHARS}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            Sent to Groq (AI) to read it · {text.length}/{MAX_CHARS}
          </p>
          <div className="flex gap-2">
            <button type="button" className={btnSecondary} onClick={onDone}>
              Cancel
            </button>
            <button type="button" className={btnPrimary} onClick={runParse} disabled={!text.trim() || parse.isPending}>
              {parse.isPending ? "Reading…" : "✨ Read list"}
            </button>
          </div>
        </div>
        <InlineError error={parse.error} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">
        {rows.length === 0 ? "No items found in that text." : `Check these ${rows.length} items before adding:`}
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[1fr_4.5rem_6.5rem_auto] gap-2">
            <input
              className={input}
              aria-label="Item name"
              value={r.name}
              maxLength={100}
              onChange={(e) => editRow(r.key, { name: e.target.value })}
            />
            <input
              className={input}
              aria-label="Quantity"
              inputMode="numeric"
              value={r.quantity}
              onChange={(e) => editRow(r.key, { quantity: e.target.value })}
            />
            <input
              className={input}
              aria-label="Estimated price per unit"
              inputMode="decimal"
              placeholder="₹ each"
              value={r.price}
              onChange={(e) => editRow(r.key, { price: e.target.value })}
            />
            <button
              type="button"
              className={`${btnGhost} hover:text-red-600`}
              aria-label={`Remove ${r.name}`}
              onClick={() => setRows((rs) => rs?.filter((x) => x.key !== r.key) ?? rs)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <InlineError error={invalidRow ? "Each item needs a name, a quantity of 1-9999 and a valid price." : null} />
      <InlineError error={addAll.error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={() => setRows(null)}>
          Back
        </button>
        <button
          type="button"
          className={btnPrimary}
          onClick={submit}
          disabled={rows.length === 0 || !!invalidRow || addAll.isPending}
        >
          {addAll.isPending ? "Adding…" : `Add ${rows.length} ${rows.length === 1 ? "item" : "items"}`}
        </button>
      </div>
    </div>
  );
}
