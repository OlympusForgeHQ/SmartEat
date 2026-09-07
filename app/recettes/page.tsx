import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { repo } from "@/lib/repo";
import { getPrefs } from "@/lib/prefs";
import { recipeCostPerServing } from "@/lib/pricing";
import { RecipeGallery, type GalleryRecipe } from "@/components/recipe-gallery";

export default async function RecettesPage() {
  const [prefs, recipes, ingredientsMap, stores] = await Promise.all([
    getPrefs(),
    repo.getRecipes(),
    repo.getIngredientsMap(),
    repo.getStores(),
  ]);
  const store = (prefs && stores.find((s) => s.id === prefs.storeId)) ?? stores[0];

  const gallery: GalleryRecipe[] = recipes.map((r) => ({
    id: r.id,
    title: r.title,
    emoji: r.emoji,
    imageUrl: r.imageUrl,
    prepMinutes: r.prepMinutes,
    mealType: r.mealTypes[0],
    slots: r.slots,
    costPerServing: recipeCostPerServing(r, ingredientsMap, store),
  }));

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-28 pt-6 lg:max-w-6xl lg:px-8 lg:pt-10">
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1 text-sm text-on-surface-muted hover:text-on-surface"
      >
        <ChevronLeft size={16} /> Accueil
      </Link>

      <h1 className="font-display text-3xl font-semibold tracking-tight">Toutes les recettes</h1>
      <p className="mt-1 text-on-surface-muted">
        {recipes.length} idées de repas, chacune avec sa photo.
      </p>

      <div className="mt-5">
        <RecipeGallery recipes={gallery} />
      </div>
    </div>
  );
}
