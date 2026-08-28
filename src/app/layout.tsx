import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { buildDataset } from "@/lib/seed";

export const metadata: Metadata = {
  title: "MRV-BlueCarbon — blue carbon monitoring, reporting & verification",
  description:
    "Prototype MRV platform for coastal blue carbon projects: field measurement, carbon accounting, verification and credit issuance.",
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
