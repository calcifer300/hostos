export interface SyncedEmail {
  id: string;
  userEmail: string;
  threadId: string | null;
  fromName: string | null;
  fromEmail: string | null;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  receivedAt: string;
  isUnread: boolean;
  guestName: string | null;
  vehicle: string | null;
  syncedAt: string;
}
