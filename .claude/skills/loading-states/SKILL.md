---
name: loading-states
description: Audit and fix loading, pending and error states in the mobile app so the user is never left guessing. Use when building or changing a screen, list, drawer or action that fetches or saves data, when asked to check loading states, skeletons or spinners, or when a screen shows "empty", "—" or nothing while waiting.
---

# Loading states

Every wait in `apps/mobile` shows that something is happening, from the tap until the screen shows the result.
The rules and the indicator table live in [docs/design-system.md#loading-states](../../../docs/design-system.md#loading-states).
Read that section first; this skill is the procedure.

## The pieces

| Need | Use |
|---|---|
| Data loading (most GETs) | A `…Skeleton` next to the real component, inside `SkeletonGroup` (`@/components/ui`) |
| Button action | `Button`'s `loading` prop |
| Action from an icon, menu or `showDialog` button | Swap that row's control for `<Spinner />`, keyed by the mutation's `variables` |
| Load failed, nothing cached | `ErrorState` with `onRetry` / `retrying` (`DrawerError` in a room drawer) |
| Action failed | `showErrorDialog(e, title)` in `onError` |
| Tab list refresh | `refreshControl={usePullToRefresh(refetch)}` (`@/hooks/usePullToRefresh`) |
| Next page | `ListFooterComponent={isFetchingNextPage ? <Spinner /> : undefined}` |
| Image | `expo-image` with `transition={t.motion.fast}` on a tinted tile |

Existing skeletons: `UserRowSkeleton` / `UserRowsSkeleton`, `RoomListItemSkeleton`, `ShopItemCardSkeleton`,
`AvatarShopItemCardSkeleton`, `AvatarEditorSkeleton`, `DrawerCardsSkeleton`, plus the private ones in
`InventoryScreen` and `ProfileScreen`. Reuse before writing a new one.

## Audit a screen (or the whole app)

1. **List every wait.** From `apps/mobile`:
   ```sh
   grep -rnE "useQuery|useInfiniteQuery|useMutation|\.mutate\(|mutateAsync|useMe\(|useMyAvatars\(|useInventory\(|useFriends\(|useIncomingRequests\(|useSuggestions\(|useMailbox\(|useRoomDetails\(" app components lib hooks
   grep -rnE "await |\.then\(" app components lib --include=*.tsx   # async work in handlers (logout, permissions, sync)
   grep -rn "socket.emit" lib hooks                                 # socket sends have no isPending at all
   ```
2. **For each query**, check in order:
   - First load (`isLoading`) shows a skeleton shaped like the content, not a centred `Spinner` (allowed only when the layout can't be known: boot, entering a room).
   - `EmptyState` renders only after loading finished. Look for `length === 0` checks that run while `data` is undefined, and `?? '—'` / `?? '?'` fallbacks shown during loading.
   - Data that changes what's shown (owned items, balances, permissions) is part of the first load: combine its `isLoading` with the list's, or the screen briefly lies ("Buy" on owned items, locked items).
   - `isError && !data` shows `ErrorState` with retry. Also cover "loaded, but the thing isn't there" (deleted item), which otherwise spins forever.
   - Tab-root lists have pull-to-refresh.
3. **For each mutation**:
   - `isPending` is visible where the user is looking: the button (`loading`), else the affected row or tile.
   - Started from a `showDialog` button? The dialog closes at once, so the pending state must be on the screen behind it.
   - A list-wide mutation shows the spinner only on the matching row: `m.isPending && m.variables?._id === row._id`.
   - If `onSuccess` refetches, it **returns** the `invalidateQueries` promise (or `Promise.all` of them), so the row doesn't flash back to its old state before the refetch lands.
   - The control is disabled while pending (no double submits), and `onError` shows a dialog. Silent failures count as a missing state.
   - Optimistic updates roll back on error.
4. **Other waits**: async handlers that aren't mutations (logout, permission prompts, contact sync) need their own `useState` flag and an indicator. Socket emits need a connection indicator.
5. **Record** anything you don't fix in `docs/known-issues.md` under "Mobile: missing loading states" (what you see, why, fix).

## Fix patterns

```tsx
// List screen: skeleton, error, empty, data, refresh
const q = useQuery({ ... });
const refreshControl = usePullToRefresh(q.refetch);   // call hooks before any early return
{q.isLoading ? (
  <SkeletonGroup style={styles.list} label="Loading rooms">
    {[0, 1, 2, 3, 4, 5].map(i => <RoomListItemSkeleton key={i} />)}
  </SkeletonGroup>
) : q.isError && !q.data ? (
  <ErrorState title="Couldn't load your rooms" onRetry={() => q.refetch()} retrying={q.isRefetching} />
) : (
  <FlatList data={q.data} refreshControl={refreshControl} ListEmptyComponent={<EmptyState ... />} ... />
)}
```

```tsx
// Row action from a dialog: spinner on that row until the list has refetched
const remove = useMutation({
  mutationFn: (u: PublicUser) => api.delete(`/.../${u._id}`),
  onSuccess: () => queryClient.invalidateQueries({ queryKey }),   // returned: stays pending until refetched
  onError: (e: Error) => showErrorDialog(e),
});
const busy = remove.isPending && remove.variables?._id === user._id;
right={busy ? <Spinner /> : <IconButton icon="ellipsis-horizontal" ... />}
// FlatList rows built from outer state need extraData={[remove.variables, remove.isPending]}
```

```tsx
// New skeleton: reuse the real component's styles, bars instead of text
export function ShopItemCardSkeleton() {
  const styles = useStyles();
  return (
    <View style={[styles.card, styles.skeletonCard]}>   {/* skeletonCard: { borderColor: t.colors.surface } */}
      <Skeleton width={60} height={60} radius="md" />
      <View style={styles.skeletonInfo}>
        <Skeleton width="55%" height={16} radius="xs" />
        <Skeleton width="85%" height={10} radius="xs" />
      </View>
    </View>
  );
}
```

On `surfaceElevated` backgrounds pass `color="border"` to `Skeleton`. Never hardcode colors or sizes: theme tokens only (see CLAUDE.md).

## Verify

1. `npx tsc --noEmit -p .` and `pnpm --filter @chat-app/mobile lint` in `apps/mobile` / the repo root.
2. Second pass: rerun the greps from step 1 and tick off every query and mutation against the checklist. Report anything left.
3. In the app: throttle the network (or stop the backend) and open each changed screen. You should see skeletons, then data. With the backend stopped you should see an error with a working retry. Tap each action and you should see a spinner until the result shows.
4. Update `docs/design-system.md` if you added a primitive, and `docs/known-issues.md` for what's left.
