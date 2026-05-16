import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import FormsHistoryPageClient from "./FormsHistoryPageClient";

export default function FormHistoryPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <FormsHistoryPageClient />
    </Suspense>
  );
}
