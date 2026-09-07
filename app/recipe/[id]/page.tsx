import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { repo } from "@/lib/repo";
import { getPrefs, DEFAULT_BUDGET } from "@/lib/prefs";
import { recipeCostPerServing } from "@/lib/pricing";
import { getPriceBook } from "@/lib/prices/price-book";
import { bestSubstitute } from "@/lib/matching-engine";
import { APPLIANCE_LABELS, CAPABILITY_LABELS, DIET_LABELS, MEAL_TYPE_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { RecipeImage } from "@/components/recipe-image";
import { NutritionCard } from "@/components/nutrition-card";
import { RecipeSteps } from "@/components/recipe-steps";
import { AiNotice } from "@/components/ai-notice";
import { FavoriteButton } from "@/components/favorite-button";
import { getDetailedRecipe } from "@/lib/ai/recipe-detail";
import { formatQty } from "@/lib/utils";
import type { DietTag } from "@/lib/types";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [recipe, ingredientsMap, stores, prefs, recipes] = await Promise.all([
    repo.getRecipe(id),
    repo.getIngredientsMap(),
    repo.getStores(),
    getPrefs(),
    repo.getRecipes(),
  ]);
  if (!recipe) notFound();

  const householdSize = prefs?.householdSize ?? 2;
  const store = stores.find((s) => s.id === prefs?.storeId) ?? stores[0];

  // Prix réels (Open Prices) pour les ingrédients de cette recette, sinon catalogue.
  const recipeIngredients = recipe.ingredients
    .map((ri) => ingredientsMap.get(ri.ingredientId))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const priceBook = await getPriceBook(recipeIngredients, store);
  const costPerServing = recipeCostPerServing(recipe, ingredientsMap, store, priceBook.unit);

  // Recette DÉTAILLÉE par IA, adaptée aux choix (repli sur la version standard).
  const detailed = await getDetailedRecipe({
    id: recipe.id,
    title: recipe.title,
    ingredients: recipe.ingredients.map((ri) => {
      const ing = ingredientsMap.get(ri.ingredientId);
      return {
        name: ing?.name ?? ri.ingredientId,
        qty: formatQty(ri.qtyPerServing * householdSize, ing?.baseUnit ?? "g"),
      };
    }),
    equipment: (prefs?.equipment ?? []).map((e) => APPLIANCE_LABELS[e].label),
    dietTags: (prefs?.dietTags ?? []).map((d) => DIET_LABELS[d].label),
    householdSize,
    ambiance: (prefs?.ambiance ?? []).map((a) => MEAL_TYPE_LABELS[a].label),
    fallbackSteps: recipe.steps,
  });

  // "Changer" : meilleur substitut éligible (même équipement/régime), hors recette courante.
  let swap: { id: string } | null = null;
  if (prefs) {
    swap = bestSubstitute(
      recipes,
      prefs,
      { budget: prefs.budget || DEFAULT_BUDGET, mealTypes: prefs.ambiance ?? [] },
      ingredientsMap,
      store,
      [recipe.id],
    );
  }

  return (
    <div className="mx-auto w-full max-w-md pb-28 lg:max-w-3xl lg:pb-16">
      {/* En-tête visuel plein cadre */}
      <div className="relative">
        <RecipeImage
          src={recipe.imageUrl}
          query={recipe.title}
          emoji={recipe.emoji}
          seed={recipe.id}
          alt={recipe.title}
          rounded="rounded-none"
          className="aspect-[16/10] w-full"
          emojiClassName="text-7xl"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        <Link
          href="/plan"
          aria-label="Retour aux repas"
          className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-surface/90 text-on-surface backdrop-blur"
        >
          <ChevronLeft size={20} />
        </Link>
        {swap && (
          <Link
            href={`/recipe/${swap.id}`}
            className="absolute right-4 top-4 inline-flex h-11 items-center gap-1.5 rounded-full bg-surface/90 px-4 text-sm font-medium text-on-surface backdrop-blur"
          >
            <RefreshCw size={15} /> Changer
          </Link>
        )}
        {/* Favori (cœur), persistant en localStorage */}
        <FavoriteButton
          recipeId={recipe.id}
          title={recipe.title}
          className="absolute bottom-4 right-4 shadow-[var(--shadow-md)]"
        />
      </div>

      <div className="px-5">
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">
          {detailed.title}
        </h1>

        <AiNotice status={detailed.status} />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {detailed.status === "ok" && <Badge tone="primary">✨ Détaillée par IA</Badge>}
          {recipe.mealTypes.map((t) => (
            <Badge key={t} tone="primary">
              {MEAL_TYPE_LABELS[t].emoji} {MEAL_TYPE_LABELS[t].label}
            </Badge>
          ))}
          {recipe.dietTags
            .filter((d): d is DietTag => d !== "halal" || recipe.dietTags.length === 1)
            .map((d) => (
              <Badge key={d}>
                {DIET_LABELS[d].emoji} {DIET_LABELS[d].label}
              </Badge>
            ))}
        </div>

        {/* Carte nutrition */}
        <div className="mt-5">
          <NutritionCard
            nutrition={recipe.nutrition}
            costPerServing={costPerServing}
            prepMinutes={recipe.prepMinutes}
          />
        </div>

        <p className="mt-3 text-xs text-on-surface-muted">
          Cuisson : {recipe.reqCapabilities.map((c) => CAPABILITY_LABELS[c]).join(", ")}.
        </p>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-on-surface-muted">
            Ingrédients ({householdSize} pers.)
          </h2>
          <ul className="overflow-hidden rounded-[var(--radius-card)] border border-outline bg-surface">
            {recipe.ingredients.map((ri) => {
              const ing = ingredientsMap.get(ri.ingredientId);
              if (!ing) return null;
              return (
                <li
                  key={ri.ingredientId}
                  className="flex items-center justify-between border-b border-outline px-4 py-2.5 last:border-b-0"
                >
                  <span className="font-medium">{ing.name}</span>
                  <span className="tnum text-sm text-on-surface-muted">
                    {formatQty(ri.qtyPerServing * householdSize, ing.baseUnit)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-on-surface-muted">
            Préparation
          </h2>
          <RecipeSteps steps={detailed.steps} />
          {detailed.tip && (
            <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/8 p-4 text-sm">
              <span className="font-semibold">💡 Astuce du chef · </span>
              {detailed.tip}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
