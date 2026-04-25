import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import { SpcLoginClient } from "./SpcLoginClient";

export default function SpcLoginPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback variant="dark" />}>
      <SpcLoginClient />
    </Suspense>
  );
}
