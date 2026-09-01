import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { repo } from "@/lib/repo";
import { getPrefs, parseMealIds, parseRequest } from "@/lib/prefs";
import { requestedSlots, toDayGrid } from "@/lib/matching-engine";
import { buildShoppingList, type MealPortion } from "@/lib/shopping-list";
import { getPriceBook } from "@/lib/prices/price-book";
import { getCurrentUser } from "@/lib/supabase/server";
import { loadPantry } from "@/app/pantry-actions";
import { defaultListName } from "@/lib/saved-lists";
import { targetParams } from "@/lib/nutrition-target";
import { BrandLogo } from "@/components/brand-logo";
import { ShoppingList } from "@/components/shopping-list";
import { SaveListButton } from "@/components/save-list-button";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const prefs = await getPrefs();
  if (!prefs) redirect("/onboarding");

  const sp = await searchParams;
  const ids = parseMealIds(sp);
  if (!ids.length) redirect("/plan");

  const [recipes, ingredientsMap, stores] = await Promise.all([
    repo.getRecipesByIds(ids),
    repo.getIngredientsMap(),
    repo.getStores(),
  ]);
  const store = stores.find((s) => s.id === prefs.storeId) ?? stores[0];

  // Prix réels (Open Prices) là où dispo, sinon repli catalogue.
  const priceBook = await getPriceBook([...ingredientsMap.values()], store);

  // Quantités au prorata des portions servies : avec une cible calorique, le
  // plan sert des portions ajustées — la liste doit acheter de quoi les couvrir.
  const target = parseRequest(sp, prefs).nutrition;
  const portions: MealPortion[] = target
    ? toDayGrid(recipes, requestedSlots(prefs), target).map((m) => ({
        recipe: m.recipe,
        factor: m.factor,
      }))
    : recipes.map((recipe) => ({ recipe, factor: 1 }));
  const list = buildShoppingList(portions, ingredientsMap, prefs.householdSize, store, priceBook.unit);

  // Placard : connecté -> Supabase, invité -> localStorage (côté client).
  const user = await getCurrentUser();
  const initialOwned = user ? await loadPantry() : [];

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-44 pt-6">
      <header className="mb-5">
        <Link
          href={`/plan?meals=${ids.join(",")}${
            target
              ? `&${new URLSearchParams(targetParams(target)).toString()}`
              : ""
          }`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-on-surface-muted hover:text-on-surface"
        >
          <ChevronLeft size={16} /> Modifier les repas
        </Link>
        <div className="flex items-center gap-3">
          <BrandLogo domain={store.domain} name={store.name} color={store.color} size={44} />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Liste de courses
            </h1>
            <p className="mt-0.5 text-sm text-on-surface-muted">
              {recipes.length} repas · {list.itemCount} produits · {store.name}
            </p>
          </div>
        </div>
      </header>

      <p className="mb-3 text-xs text-on-surface-muted">
        Coche « j&apos;ai déjà » pour ce que tu as dans ton placard — on l&apos;enlève du total.
      </p>

      {/* Liste interactive (produits entiers + placard) */}
      <ShoppingList
        sections={list.sections}
        storeName={store.name}
        authed={!!user}
        initialOwned={initialOwned}
      />

      {/* Sauvegarder — pour garder plusieurs listes de courses */}
      <div className="mt-6">
        <SaveListButton
          authed={!!user}
          input={{
            name: defaultListName(store.name),
            storeName: store.name,
            mealIds: ids,
            itemCount: list.itemCount,
            total: list.total,
          }}
        />
      </div>

      {/* Recettes de la semaine avec toutes les étapes */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">
          Recettes de la semaine
        </h2>
        <div className="space-y-2.5">
          {recipes.map((recipe) => (
            <details
              key={recipe.id}
              className="overflow-hidden rounded-[var(--radius-card)] border border-outline bg-surface"
            >
              <summary className="flex cursor-pointer items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <span className="text-2xl" aria-hidden>
                  {recipe.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{recipe.title}</span>
                  <span className="block text-xs text-on-surface-muted">
                    {recipe.prepMinutes} min · {recipe.steps.length} étapes
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-on-surface-muted" />
              </summary>
              <div className="border-t border-outline px-4 pb-4 pt-3">
                <ol className="space-y-2.5">
                  {recipe.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <p className="pt-0.5 text-sm">{step}</p>
                    </li>
                  ))}
                </ol>
                <Link
                  href={`/recipe/${recipe.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary"
                >
                  Voir la recette complète <ChevronRight size={14} />
                </Link>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
