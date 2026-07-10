import { requireUser } from "@/lib/rbac";
import { listModels } from "@/features/modeling/queries";
import { ModelLibrary, type ModelLibraryRow } from "./model-library";

export const dynamic = "force-dynamic";

export default async function ModelingLibraryPage() {
  const user = await requireUser();
  const { rows, total } = await listModels({ limit: 100, user });

  // Map to the serializable client-component shape (Date → ISO string).
  const libraryRows: ModelLibraryRow[] = rows.map((r) => ({
    financialModelId: r.financialModelId,
    modelType: r.modelType,
    version: r.version,
    scenarioTag: r.scenarioTag,
    currencyCode: r.currencyCode,
    dealCode: r.dealCode,
    dealName: r.dealName,
    partyName: r.partyName,
    computedAt: r.computedAt ? r.computedAt.toISOString() : null,
    headline: r.headline,
  }));

  return <ModelLibrary rows={libraryRows} total={total} />;
}
