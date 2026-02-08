"use client";

import { useSession } from "next-auth/react";
import { TamboLensProvider } from "@/components/providers/tambo-provider";
import { AppProvider } from "@/components/providers/app-context";
import { DashboardProvider } from "@/components/providers/dashboard-context";
import { AppShell } from "@/components/layout/app-shell";
import { AuthView } from "@/components/views/auth-view";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated — show login
  if (!session) {
    return <AuthView />;
  }

  // Authenticated — show the app
  return (
    <AppProvider>
      <TamboLensProvider>
        <DashboardProvider>
          <AppShell />
        </DashboardProvider>
      </TamboLensProvider>
    </AppProvider>
  );
}
