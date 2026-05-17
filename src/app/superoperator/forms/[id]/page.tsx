import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import FillFormPageClient from "@/app/forms/[id]/FillFormPageClient";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuperOperatorFillRoutePage(props: PageProps) {
  const [{ id }, spRaw] = await Promise.all([
    props.params,
    props.searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);

  const pick = (k: string) => {
    const v = spRaw[k];
    return typeof v === "string" ? v : undefined;
  };

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <FillFormPageClient
        templateId={id}
        submissionId={pick("submissionId")}
        folderId={undefined}
        note={pick("note")}
        mode="superoperator"
      />
    </Suspense>
  );
}
