import { useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { parseMoney } from "../lib/format";
import { btnPrimary, btnSecondary, input } from "../lib/ui";
import type { ItemInput } from "../api/hooks";
import { InlineError } from "./Feedback";

const schema = z.object({
  name: z.string().trim().min(1, "Enter an item name").max(100, "Too long"),
  quantity: z.string().regex(/^[1-9]\d{0,3}$/, "Whole number, 1-9999"),
  price: z.string().refine((v) => parseMoney(v) !== null, "Enter a price like 45 or 45.50"),
});
type Form = z.infer<typeof schema>;

interface Props {
  initial?: Form;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (value: ItemInput) => Promise<unknown>;
  onCancel?: () => void;
  /** Clear the form after a successful submit (for "add" mode). */
  resetOnSuccess?: boolean;
}

export function ItemForm({ initial, submitLabel, pending, error, onSubmit, onCancel, resetOnSuccess }: Props) {
  const id = useId();
  const { register, handleSubmit, formState, reset, setFocus } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? { name: "", quantity: "1", price: "" },
  });

  const submit = handleSubmit(async (v) => {
    try {
      await onSubmit({ name: v.name, quantity: Number(v.quantity), estimatedPriceCents: parseMoney(v.price) ?? 0 });
      if (resetOnSuccess) {
        reset();
        setFocus("name");
      }
    } catch {
      // error is shown via the `error` prop
    }
  });

  const e = formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <div className="grid grid-cols-[1fr_4.5rem_6.5rem] gap-2">
        <div>
          <label className="sr-only" htmlFor={`${id}-name`}>
            Item name
          </label>
          <input
            id={`${id}-name`}
            className={input}
            placeholder="Item"
            aria-invalid={!!e.name}
            {...register("name")}
          />
        </div>
        <div>
          <label className="sr-only" htmlFor={`${id}-qty`}>
            Quantity
          </label>
          <input
            id={`${id}-qty`}
            className={input}
            inputMode="numeric"
            placeholder="Qty"
            aria-invalid={!!e.quantity}
            {...register("quantity")}
          />
        </div>
        <div>
          <label className="sr-only" htmlFor={`${id}-price`}>
            Estimated price per unit
          </label>
          <input
            id={`${id}-price`}
            className={input}
            inputMode="decimal"
            placeholder="₹ each"
            aria-invalid={!!e.price}
            {...register("price")}
          />
        </div>
      </div>
      <InlineError error={e.name?.message ?? e.quantity?.message ?? e.price?.message} />
      <InlineError error={error} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className={btnPrimary} disabled={pending}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
