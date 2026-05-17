import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import { SuperOperatorLoginClient } from "./SuperOperatorLoginClient";

export default function SuperOperatorLoginPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <SuperOperatorLoginClient />
    </Suspense>
  );
}
