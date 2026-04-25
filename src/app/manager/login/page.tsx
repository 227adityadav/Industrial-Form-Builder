import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import { ManagerLoginClient } from "./ManagerLoginClient";

export default function ManagerLoginPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <ManagerLoginClient />
    </Suspense>
  );
}

