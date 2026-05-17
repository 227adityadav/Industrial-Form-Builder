import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import UserSubmissionViewPageClient from "@/app/forms/view/[id]/UserSubmissionViewPageClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SuperOperatorViewSubmissionPage(props: PageProps) {
  const { id } = await props.params;
  const submissionId = decodeURIComponent(id).trim();

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <UserSubmissionViewPageClient submissionId={submissionId} mode="superoperator" />
    </Suspense>
  );
}
