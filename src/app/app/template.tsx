import { PageTransition } from "@/components/motion/page-transition";

/**
 * Re-mounts on every navigation inside the product (a layout would not), so
 * each page enters with the same short fade-and-rise.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
