import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ChatPopup } from "@/components/layout/chat-popup";
import { getSetupState } from "@/lib/openclaw";

// Must be dynamic — getSetupState reads files from disk at request time
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const setupState = await getSetupState();
  if (setupState === "pending") {
    redirect("/setup");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>

      <Header />

      <main id="main-content" className="flex-1 overflow-auto p-4 sm:p-6">
        {children}
      </main>

      {/* Floating chat popup — available on all pages */}
      <ChatPopup />
    </div>
  );
}
