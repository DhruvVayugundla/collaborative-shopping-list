import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { socket } from "./socket";
import { keys } from "../api/hooks";
import { removeItem, removeMember, upsertItem, upsertMember } from "../api/cache";
import type { Item, ListDetail, Member } from "../types";

/** Keeps the cached list detail in sync with changes other members make. */
export function useListSocket(listId: string, myUserId: string) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const key = keys.list(listId);
    const update = (fn: (l: ListDetail) => ListDetail) =>
      qc.setQueryData<ListDetail>(key, (old) => (old ? fn(old) : old));
    const forThisList = <T extends { listId: string }>(handler: (p: T) => void) => (p: T) => {
      if (p.listId === listId) handler(p);
    };

    // Refetch after joining so nothing that happened before the join (or while offline) is missed.
    const join = () =>
      socket.emit("list:join", { listId }, () => qc.invalidateQueries({ queryKey: key }));

    const onItem = forThisList<{ listId: string; item: Item }>(({ item }) => update((l) => upsertItem(l, item)));
    const onItemDeleted = forThisList<{ listId: string; itemId: string }>(({ itemId }) =>
      update((l) => removeItem(l, itemId)),
    );
    const onMemberAdded = forThisList<{ listId: string; member: Member }>(({ member }) =>
      update((l) => upsertMember(l, member)),
    );
    const onMemberRemoved = forThisList<{ listId: string; userId: string }>(({ userId }) => {
      if (userId === myUserId) {
        qc.removeQueries({ queryKey: key });
        navigate("/lists", { replace: true, state: { notice: "You were removed from that list." } });
      } else {
        update((l) => removeMember(l, userId));
      }
    });
    const onListUpdated = ({ list }: { list: { id: string; name: string } }) => {
      if (list.id === listId) update((l) => ({ ...l, name: list.name }));
    };
    const onListDeleted = forThisList<{ listId: string }>(() => {
      qc.removeQueries({ queryKey: key });
      navigate("/lists", { replace: true, state: { notice: "That list was deleted." } });
    });

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("item:created", onItem);
    socket.on("item:updated", onItem);
    socket.on("item:deleted", onItemDeleted);
    socket.on("member:added", onMemberAdded);
    socket.on("member:removed", onMemberRemoved);
    socket.on("list:updated", onListUpdated);
    socket.on("list:deleted", onListDeleted);

    return () => {
      socket.emit("list:leave", { listId });
      socket.off("connect", join);
      socket.off("item:created", onItem);
      socket.off("item:updated", onItem);
      socket.off("item:deleted", onItemDeleted);
      socket.off("member:added", onMemberAdded);
      socket.off("member:removed", onMemberRemoved);
      socket.off("list:updated", onListUpdated);
      socket.off("list:deleted", onListDeleted);
    };
  }, [listId, myUserId, qc, navigate]);
}
