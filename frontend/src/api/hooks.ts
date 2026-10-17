import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api } from "./client";
import { removeItem, removeMember, upsertItem, upsertMember } from "./cache";
import type { Item, ListDetail, ListSummary, Member, User } from "../types";

export const keys = {
  me: ["me"] as const,
  lists: ["lists"] as const,
  list: (id: string) => ["list", id] as const,
};

// ---- auth ----

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return (await api<{ user: User }>("GET", "/auth/me")).user;
      } catch (err) {
        if ((err as { status?: number }).status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
  });
}

type Credentials = { username: string; password: string };

export function useLogin(mode: "login" | "register") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Credentials) => api<{ user: User }>("POST", `/auth/${mode}`, body),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(keys.me, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api("POST", "/auth/logout"),
    // Settled, not success: even if the request fails, the local session is dropped.
    onSettled: () => {
      // Keep the "me" query (now null) so mounted observers see the logout; drop everything else.
      qc.setQueryData(keys.me, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== keys.me[0] });
      // Clear the user first so the login page doesn't bounce back; plain /login, no "return to" page.
      navigate("/login", { replace: true });
    },
  });
}

// ---- lists ----

export function useLists() {
  return useQuery({
    queryKey: keys.lists,
    queryFn: async () => (await api<{ lists: ListSummary[] }>("GET", "/lists")).lists,
  });
}

export function useList(listId: string) {
  return useQuery({
    queryKey: keys.list(listId),
    queryFn: async () => (await api<{ list: ListDetail }>("GET", `/lists/${listId}`)).list,
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<{ list: ListSummary }>("POST", "/lists", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.lists }),
  });
}

/** Apply an updater to the cached list detail, if it is loaded. */
function useUpdateListCache(listId: string) {
  const qc = useQueryClient();
  return (fn: (list: ListDetail) => ListDetail) =>
    qc.setQueryData<ListDetail>(keys.list(listId), (old) => (old ? fn(old) : old));
}

export function useRenameList(listId: string) {
  const update = useUpdateListCache(listId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<{ list: { name: string } }>("PATCH", `/lists/${listId}`, { name }),
    onSuccess: ({ list }) => {
      update((l) => ({ ...l, name: list.name }));
      qc.invalidateQueries({ queryKey: keys.lists });
    },
  });
}

export function useDeleteList(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("DELETE", `/lists/${listId}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: keys.list(listId) });
      qc.invalidateQueries({ queryKey: keys.lists });
    },
  });
}

// ---- members ----

export function useAddMember(listId: string) {
  const update = useUpdateListCache(listId);
  return useMutation({
    mutationFn: (username: string) =>
      api<{ member: Member }>("POST", `/lists/${listId}/members`, { username }),
    onSuccess: ({ member }) => update((l) => upsertMember(l, member)),
  });
}

export function useRemoveMember(listId: string) {
  const update = useUpdateListCache(listId);
  return useMutation({
    mutationFn: (userId: string) => api("DELETE", `/lists/${listId}/members/${userId}`),
    onSuccess: (_data, userId) => update((l) => removeMember(l, userId)),
  });
}

// ---- items ----

export type ItemInput = { name: string; quantity: number; estimatedPriceCents: number };

export function useAddItem(listId: string) {
  const update = useUpdateListCache(listId);
  return useMutation({
    mutationFn: (body: ItemInput) => api<{ item: Item }>("POST", `/lists/${listId}/items`, body),
    onSuccess: ({ item }) => update((l) => upsertItem(l, item)),
  });
}

export function useUpdateItem(listId: string) {
  const qc = useQueryClient();
  const update = useUpdateListCache(listId);
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<ItemInput & { purchased: boolean }>) =>
      api<{ item: Item }>("PATCH", `/lists/${listId}/items/${id}`, patch),
    // Optimistic only for the purchased toggle, the most frequent action while shopping.
    onMutate: async ({ id, purchased }) => {
      if (purchased === undefined) return;
      await qc.cancelQueries({ queryKey: keys.list(listId) });
      const previous = qc.getQueryData<ListDetail>(keys.list(listId));
      update((l) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, purchased } : i)) }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.list(listId), ctx.previous);
    },
    onSuccess: ({ item }) => update((l) => upsertItem(l, item)),
  });
}

export function useDeleteItem(listId: string) {
  const update = useUpdateListCache(listId);
  return useMutation({
    mutationFn: (itemId: string) => api("DELETE", `/lists/${listId}/items/${itemId}`),
    onSuccess: (_data, itemId) => update((l) => removeItem(l, itemId)),
  });
}

// ---- AI quick-add ----

export function useFeatures() {
  return useQuery({
    queryKey: ["features"],
    queryFn: () => api<{ aiQuickAdd: boolean }>("GET", "/features"),
    staleTime: Infinity,
  });
}

/** Turns free text into draft items. Nothing is saved until useAddItemsBulk. */
export function useParseItems(listId: string) {
  return useMutation({
    mutationFn: async (text: string) =>
      (await api<{ items: ItemInput[] }>("POST", `/lists/${listId}/items/parse`, { text })).items,
  });
}

export function useAddItemsBulk(listId: string) {
  const update = useUpdateListCache(listId);
  return useMutation({
    mutationFn: (items: ItemInput[]) => api<{ items: Item[] }>("POST", `/lists/${listId}/items/bulk`, { items }),
    onSuccess: ({ items }) => update((l) => items.reduce(upsertItem, l)),
  });
}
