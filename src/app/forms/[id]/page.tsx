import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/RouteLoadingFallback";
import FillFormPageClient from "./FillFormPageClient";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FormsFillRoutePage(props: PageProps) {
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
        folderId={pick("folderId")}
        note={pick("note")}
      />
    </Suspense>
  );
}
