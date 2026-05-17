import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import FormsHistoryPageClient from "@/app/forms/history/FormsHistoryPageClient";

export default function SuperOperatorHistoryPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <FormsHistoryPageClient mode="superoperator" />
    </Suspense>
  );
}
