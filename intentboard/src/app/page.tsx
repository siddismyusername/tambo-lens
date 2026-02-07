"use client";

import { IntentBoardProvider } from "@/components/providers/tambo-provider";
import { AppProvider } from "@/components/providers/app-context";
import { DashboardProvider } from "@/components/providers/dashboard-context";
import { AppShell } from "@/components/layout/app-shell";

export default function Home() {
  return (
    <AppProvider>
      <IntentBoardProvider>
        <DashboardProvider>
          <AppShell />
        </DashboardProvider>
      </IntentBoardProvider>
    </AppProvider>
  );
}
