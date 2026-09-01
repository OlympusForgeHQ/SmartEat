import { redirect } from "next/navigation";
import type { MealSlot } from "@/lib/types";
import { repo } from "@/lib/repo";
import { getPrefs, parseMealIds, parseRequest } from "@/lib/prefs";
import {
  buildPlanFromIds,
  planWeek,
  requestedSlots,
  slotSubstitutes,
  toDayGrid,
  type PlannedMeal,
} from "@/lib/matching-engine";
import { buildShoppingList, type MealPortion } from "@/lib/shopping-list";
import { dayTotals, targetParams } from "@/lib/nutrition-target";
import { recipeMealCost } from "@/lib/pricing";
import { getPriceBook } from "@/lib/prices/price-book";
import { getCurrentUser } from "@/lib/supabase/server";
import { FilterBar } from "@/components/filter-bar";
import { PlanView, type PlanViewData } from "@/components/plan-view";

type SearchParams = Record<string, string | string[] | undefined>;

function planHref(
  budget: number,
  types: string[],
  meals: string[],
  target: Record<string, string>,
  seed?: number,
) {
  const params = new URLSearchParams();
  params.set("budget", String(budget));
  if (types.length) params.set("types", types.join(","));
  if (meals.length) params.set("meals", meals.join(","));
  if (seed) params.set("seed", String(seed));
  // La cible du calculateur reste attachée au plan (échange, régénération, liste).
  for (const [k, v] of Object.entries(target)) params.set(k, v);
  return `/plan?${params.toString()}`;
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const prefs = await getPrefs();
  if (!prefs) redirect("/onboarding");

  const sp = await searchParams;
  const request = parseRequest(sp, prefs);

  const [recipes, ingredientsMap, stores] = await Promise.all([
    repo.getRecipes(),
    repo.getIngredientsMap(),
    repo.getStores(),
  ]);
  const store = stores.find((s) => s.id === prefs.storeId) ?? stores[0];

  // Prix RÉELS (Open Prices) là où dispo, sinon repli catalogue. Résolu une fois.
  const priceBook = await getPriceBook([...ingredientsMap.values()], store);

  // Moments demandés (ordre matin -> soir, repli midi + soir).
  const selectedSlots: MealSlot[] = requestedSlots(prefs);

  // Grille JOUR × MOMENT : ids fournis (après swap) sinon plan hebdo budget-aware.
  const presetIds = parseMealIds(sp);
  let meals: PlannedMeal[];
  let withinBudget = true;
  let plannedDays = 0;
  if (presetIds.length) {
    meals = toDayGrid(buildPlanFromIds(presetIds, recipes), selectedSlots, request.nutrition);
    plannedDays = new Set(meals.map((m) => m.day)).size;
  } else {
    const plan = planWeek(recipes, prefs, request, ingredientsMap, store, priceBook.unit);
    meals = plan.meals;
    withinBudget = plan.withinBudget;
    plannedDays = plan.plannedDays;
  }
  const selected = meals.map((m) => m.recipe);
  const selectedIds = selected.map((r) => r.id);

  // Panier : quantités au prorata des portions réellement servies (une cible
  // calorique haute fait manger 1,4 portion -> il faut acheter en conséquence).
  const portions: MealPortion[] = meals.map((m) => ({ recipe: m.recipe, factor: m.factor }));
  const list = buildShoppingList(portions, ingredientsMap, prefs.householdSize, store, priceBook.unit);

  // Cible du calculateur : moyenne réellement atteinte par jour et par personne.
  const target = request.nutrition;
  const tParams = targetParams(target);
  const dayCount = Math.max(1, new Set(meals.map((m) => m.day)).size);
  const totals = dayTotals(portions);
  // Semaine incomplète avec une cible : le budget, pas le catalogue, est le
  // facteur limitant (les portions ajustées coûtent plus cher). On chiffre la
  // semaine entière à cette cible pour proposer un budget qui la couvre —
  // sinon l'utilisateur ne peut que deviner.
  let budgetSemaine: number | null = null;
  if (target && !withinBudget && !presetIds.length) {
    const complet = planWeek(
      recipes,
      prefs,
      { ...request, budget: Number.MAX_SAFE_INTEGER },
      ingredientsMap,
      store,
      priceBook.unit,
    );
    if (complet.withinBudget) budgetSemaine = Math.ceil(complet.total / 5) * 5;
  }

  const nutritionTarget = target
    ? {
        kcalCible: Math.round(target.kcal),
        kcalAtteint: Math.round(totals.kcal / dayCount),
        proteinesCible: Math.round(target.proteinesG),
        proteinesAtteint: Math.round(totals.proteinesG / dayCount),
        resetHref: planHref(request.budget, request.mealTypes, [], {}),
        budgetSemaine,
        budgetHref: budgetSemaine
          ? planHref(budgetSemaine, request.mealTypes, [], tParams)
          : null,
      }
    : null;

  // Substituts par MOMENT : "Changer" remplace un repas par un autre du même
  // moment, absent de la semaine (position conservée -> même jour/moment).
  const subFor = slotSubstitutes(
    recipes,
    prefs,
    request,
    ingredientsMap,
    store,
    selectedIds,
    priceBook.unit,
  );

  // "Régénérer" = nouvelle graine de variété (sélection différente, toujours <= budget).
  const nextSeed = (request.seed ?? 1) * 7 + 13;

  // Navigation : connecté -> dashboard compte ; invité -> accueil. Jamais bloqué.
  const user = await getCurrentUser();
  const home = user
    ? { href: "/compte", label: "Mon compte" }
    : { href: "/", label: "Accueil" };

  const viewData: PlanViewData = {
    store: { name: store.name, domain: store.domain, color: store.color },
    recipes: meals.map(({ recipe, slot, day, factor }) => {
      const sub = subFor(slot);
      return {
        id: recipe.id,
        title: recipe.title,
        emoji: recipe.emoji,
        imageUrl: recipe.imageUrl,
        prepMinutes: recipe.prepMinutes,
        mealTypes: recipe.mealTypes,
        slot,
        day,
        // Équilibre de la semaine : nutrition estimée PAR PORTION (voir plan-view).
        kcal: recipe.nutrition.kcal,
        protein: recipe.nutrition.protein,
        mealCost: recipeMealCost(recipe, ingredientsMap, store, prefs.householdSize, priceBook.unit),
        factor,
        swapHref: sub
          ? planHref(
              request.budget,
              request.mealTypes,
              selectedIds.map((id) => (id === recipe.id ? sub.id : id)),
              tParams,
            )
          : null,
      };
    }),
    selectedIds,
    total: list.total,
    budget: request.budget,
    itemCount: list.itemCount,
    householdSize: prefs.householdSize,
    plannedDays,
    withinBudget,
    regenerateHref: planHref(request.budget, request.mealTypes, [], tParams, nextSeed),
    listHref: `/list?meals=${selectedIds.join(",")}${
      target ? `&${new URLSearchParams(tParams).toString()}` : ""
    }`,
    nutritionTarget,
    homeHref: home.href,
    homeLabel: home.label,
    priceLive: priceBook.liveCount,
    priceStatus: priceBook.status,
  };

  return (
    <PlanView {...viewData}>
      {/* Ajuster les arbitrages de la semaine (budget + envies). Rendu en
          children pour rester AU-DESSUS du CTA flottant (padding pb-44). */}
      <details className="group mt-6">
        <summary className="mb-3 inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-on-surface-muted [&::-webkit-details-marker]:hidden">
          Ajuster cette semaine
          <span className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <FilterBar initialBudget={request.budget} initialTypes={request.mealTypes} />
      </details>
    </PlanView>
  );
}
