import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import { SuperAdminLoginClient } from "./SuperAdminLoginClient";

export default function SuperAdminLoginPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <SuperAdminLoginClient />
    </Suspense>
  );
}
