import { BoardClient } from "@/components/board/board-client";
import { getBoardData } from "@/lib/board/queries";
import { canEditCurrentFleet } from "@/lib/host/context";

/**
 * The cross-fleet operations board.
 *
 * Server-renders the trips and their first countdown reading; the client
 * recomputes those every second from the same engine. See board-client.tsx for
 * why that split rather than either alone.
 */
export default async function BoardPage() {
  const [{ trips, fleets, degraded }, canEdit] = await Promise.all([
    getBoardData(),
    canEditCurrentFleet(),
  ]);

  return (
    <>
      {degraded && (
        <p className="mx-auto mb-4 w-full max-w-[1400px] rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[12.5px] text-warning">
          Some trips couldn&rsquo;t be loaded just now, so this board may be incomplete.
        </p>
      )}
      <BoardClient trips={trips} fleets={fleets} canEdit={canEdit} />
    </>
  );
}
