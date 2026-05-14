import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import UserSubmissionViewPageClient from "./UserSubmissionViewPageClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Submission readonly view. `params.id` is the submission document id (same as GET /api/submissions/:id).
 */
export default async function FormsViewSubmissionPage(props: PageProps) {
  const { id } = await props.params;
  const submissionId = decodeURIComponent(id).trim();

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <UserSubmissionViewPageClient submissionId={submissionId} />
    </Suspense>
  );
}
