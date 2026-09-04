import { buildDataset } from "@/lib/seed";

/**
 * Prerender every project page at build time. The project list is known
 * statically, so navigating to a project costs a static-file fetch instead of a
 * server render (~180 ms → ~20 ms).
 */
export function generateStaticParams() {
  return buildDataset().projects.map((p) => ({ id: p.id }));
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
