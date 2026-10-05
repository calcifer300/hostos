import { getKnowledgeBase, hasSavedKnowledgeBase } from "@/lib/knowledge/queries";
import { KnowledgeEditor } from "@/components/knowledge/knowledge-editor";
import { canEditCurrentFleet, getCurrentHostId } from "@/lib/host/context";

/**
 * The knowledge base is fleet configuration, so it is keyed on host_id
 * (migration 0013) rather than on the signed-in Google address.
 *
 * That removes the "connect Google to edit your knowledge base" gate this
 * page used to open with. The gate was never about Gmail — it existed only
 * because the row's primary key happened to be an email address, which meant
 * a Companion-only operator, who needs no Google account for anything else,
 * could not write their own house rules.
 */
export default async function KnowledgePage() {
  const hostId = await getCurrentHostId();

  const [knowledge, isSaved, canEdit] = await Promise.all([
    getKnowledgeBase(hostId),
    hasSavedKnowledgeBase(hostId),
    canEditCurrentFleet(),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Knowledge</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Your check-in process, house rules, and policies — the facts HostOS grounds every reply
          in.{" "}
          {isSaved
            ? "Shared by everyone on this fleet."
            : "Showing the starting defaults until you save your own."}
        </p>
      </div>

      <KnowledgeEditor initial={knowledge} readOnly={!canEdit} />
    </div>
  );
}
