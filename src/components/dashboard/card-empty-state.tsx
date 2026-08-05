/** Consistent "nothing here yet" copy for data-backed dashboard cards. */
export function CardEmptyState({ message }: { message: string }) {
  return <p className="py-1 text-[13px] leading-relaxed text-muted-foreground">{message}</p>;
}
