import { redirect } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { repo } from "@/lib/repo";
import { GeneratingView } from "./generating-view";

type SearchParams = Record<string, string | string[] | undefined>;

// Interstitiel "on prépare ta semaine…" (Romi). Affiche une checklist animée
// côté client, puis redirige vers /plan. Les prefs doivent exister.
export default async function GeneratingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const prefs = await getPrefs();
  if (!prefs) redirect("/onboarding");

  const sp = await searchParams;
  const params = new URLSearchParams();
  const budget = typeof sp.budget === "string" ? sp.budget : undefined;
  const types = typeof sp.types === "string" ? sp.types : undefined;
  const seed = typeof sp.seed === "string" ? sp.seed : undefined;
  if (budget) params.set("budget", budget);
  if (types) params.set("types", types);
  if (seed) params.set("seed", seed);
  // Cible du calculateur diète : transmise telle quelle au plan (kcal + macros).
  for (const key of ["kcal", "prot", "gluc", "lip"]) {
    const value = sp[key];
    if (typeof value === "string") params.set(key, value);
  }
  const planHref = `/plan${params.toString() ? `?${params.toString()}` : ""}`;

  const store = await repo.getStore(prefs.storeId);

  return <GeneratingView planHref={planHref} storeName={store?.name} />;
}
