import { z } from "zod";

export const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, "Username must be 3-30 characters: letters, numbers or underscores"),
  // bcrypt only uses the first 72 bytes
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

const listName = z.string().trim().min(1, "List name is required").max(100, "List name is too long");

export const listBodySchema = z.object({ name: listName });

export const memberBodySchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Username is required"),
});

const itemName = z.string().trim().min(1, "Item name is required").max(100, "Item name is too long");
const quantity = z
  .number()
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(9999, "Quantity is too large");
const price = z.number().int().min(0, "Price cannot be negative").max(100_000_000, "Price is too large");

export const createItemSchema = z.object({
  name: itemName,
  quantity: quantity.default(1),
  estimatedPriceCents: price.default(0),
});

export const MAX_BULK_ITEMS = 50;

export const parseTextSchema = z.object({
  text: z.string().trim().min(1, "Paste or type some items first").max(2000, "Keep it under 2000 characters"),
});

export const bulkItemsSchema = z.object({
  items: z
    .array(createItemSchema)
    .min(1, "Add at least one item")
    .max(MAX_BULK_ITEMS, `At most ${MAX_BULK_ITEMS} items at once`),
});

export const updateItemSchema = z
  .object({
    name: itemName,
    quantity,
    estimatedPriceCents: price,
    purchased: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
