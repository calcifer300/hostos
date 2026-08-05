import { BookOpen } from "lucide-react";
import { auth } from "@/auth";
import { getKnowledgeBase, hasSavedKnowledgeBase } from "@/lib/knowledge/queries";
import { KnowledgeEditor } from "@/components/knowledge/knowledge-editor";
import { ConnectGoogleNotice } from "@/components/shell/connect-google-notice";

// NOTE: knowledge_base is keyed by user_email (Sprint 4, tied to the Google
// session) even though it's host configuration rather than Gmail data — a
// candidate to move to host_id-keyed storage in a later phase, alongside
// automation_settings, so it works with no Google account connected at all.
export default async function KnowledgePage() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight">Knowledge</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            Your check-in process, house rules, and policies — the facts iHost grounds every reply in.
          </p>
        </div>
        <ConnectGoogleNotice
          icon={BookOpen}
          title="Connect Google to edit your knowledge base"
          description="Your knowledge base is currently saved against your Google account. Connect one to edit and save it."
        />
      </div>
    );
  }

  const [knowledge, isSaved] = await Promise.all([
    getKnowledgeBase(email),
    hasSavedKnowledgeBase(email),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Knowledge</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Your check-in process, house rules, and policies — the facts iHost grounds every reply
          in. {isSaved ? "Saved to your account." : "Showing the starting defaults until you save your own."}
        </p>
      </div>

      <KnowledgeEditor initial={knowledge} />
    </div>
  );
}
