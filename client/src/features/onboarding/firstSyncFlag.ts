// set when the first import is kicked off, cleared on "Open dashboard" — lets
// a mid-sync reload land back on the progress card even though some
// activities already exist in the database by then.
// Lives outside FirstSyncPage.tsx so App.tsx and lib/boot.ts can read the flag
// without pulling the whole (lazy-loaded) component into the entry chunk.
export const FIRST_SYNC_FLAG = 'first-sync-pending';
