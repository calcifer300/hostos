import type { LucideIcon } from "lucide-react";

export function SectionPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start pt-8">
      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
        <Icon className="h-[17px] w-[17px] text-muted-foreground" strokeWidth={1.75} />
      </div>
      <h1 className="mb-2 text-[20px] font-semibold tracking-tight">{title}</h1>
      <p className="text-[14px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
