import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { buildDataset } from "@/lib/seed";
import { BRAND } from "@/lib/branding";

export const metadata: Metadata = {
  title: {
    default: `${BRAND.product} — blue carbon monitoring, reporting & verification`,
    template: `%s · ${BRAND.product}`,
  },
  description:
    "MRV platform for coastal blue carbon projects: field measurement, carbon accounting, verification and credit issuance.",
  applicationName: BRAND.product,
  authors: [{ name: BRAND.owner, url: BRAND.github }],
  creator: BRAND.owner,
  publisher: BRAND.owner,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Generated deterministically on the server so the first paint has real content.
  const seed = buildDataset();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <StoreProvider initialData={seed}>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
