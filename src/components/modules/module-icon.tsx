import { Blocks, Car, ChefHat, Coffee, Globe, Scissors, ShoppingBag, type LucideIcon } from "lucide-react";
import type { ModuleIcon as ModuleIconName } from "@/lib/modules";

/** The one place a module's icon name becomes a component. */
export const MODULE_ICONS: Record<ModuleIconName, LucideIcon> = { Car, ChefHat, ShoppingBag, Globe, Coffee, Scissors, Blocks };

export function ModuleIcon({ name, className, strokeWidth = 1.75 }: { name: ModuleIconName; className?: string; strokeWidth?: number }) {
  const Icon = MODULE_ICONS[name];
  return <Icon className={className} strokeWidth={strokeWidth} />;
}
