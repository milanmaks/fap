import { redirect } from "next/navigation";

export default function DatasetPage({ params }: { params: { datasetId: string } }) {
  redirect(`/?datasetId=${params.datasetId}`);
}
