import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import { DashboardLoginClient } from "./DashboardLoginClient";

export default function DashboardLoginPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <DashboardLoginClient />
    </Suspense>
  );
}
