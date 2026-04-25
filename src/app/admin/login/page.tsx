import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import { AdminLoginClient } from "./AdminLoginClient";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <AdminLoginClient />
    </Suspense>
  );
}

