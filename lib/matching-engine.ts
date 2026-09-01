import type { GenerationRequest, Ingredient, MealSlot, Recipe, Store, UserPrefs } from "./types";
import type { NutritionTarget } from "./nutrition-target";
import { userCapabilities } from "./capabilities";
import { MEAL_SLOT_ORDER, PROTEIN_MIN, PROTEIN_MIN_COLLATION } from "./labels";
import { recipeCostPerServing } from "./pricing";
import { buildShoppingList, type MealPortion } from "./shopping-list";
import { portionFactor, slotKcalTargets, slotShares, targetAffinity } from "./nutrition-target";

// Recipe Matching Engine — §2, version "budget-aware".
// 1) Filtres durs (régime / équipement / moment / ambiance) -> élimination.
// 2) Scoring doux (type, prix au magasin, rapidité) -> classement.
// 3) Plan hebdo glouton, équilibré entre moments, qui garantit : total <= budget.

const DEFAULT_SLOTS: MealSlot[] = ["dejeuner", "diner"];

// La semaine se planifie JOUR par JOUR (Lundi -> Dimanche). Chaque jour reçoit
// une recette par moment demandé (petit-déj / déjeuner / dîner).
export const WEEK_LEN = 7;

// Moments demandés, TRIÉS dans l'ordre canonique (matin -> soir). L'ordre fixe
// garantit que le petit-déj n'est pas affamé par l'ordre de sélection : il passe
// en premier au tourniquet du plan. Repli midi + soir si rien n'est précisé.
export function requestedSlots(prefs: UserPrefs): MealSlot[] {
  const sel = prefs.mealSlots?.length ? prefs.mealSlots : DEFAULT_SLOTS;
  return MEAL_SLOT_ORDER.filter((s) => sel.includes(s));
}

// Moment d'affichage d'une recette = premier moment demandé qu'elle couvre.
export function displaySlot(recipe: Recipe, selectedSlots: MealSlot[]): MealSlot {
  return selectedSlots.find((s) => recipe.slots.includes(s)) ?? recipe.slots[0] ?? "diner";
}

// Répartit une sélection entre les moments demandés en ÉQUILIBRANT les effectifs :
// un plat servable midi ET soir ira au moment le moins rempli. Évite que tous les
// plats polyvalents se massent au déjeuner et laissent le dîner vide.
export function assignSlots(
  recipes: Recipe[],
  selectedSlots: MealSlot[],
): Map<string, MealSlot> {
  const slots = selectedSlots.length ? selectedSlots : DEFAULT_SLOTS;
  const count = new Map<MealSlot, number>(slots.map((s) => [s, 0]));
  const out = new Map<string, MealSlot>();
  for (const r of recipes) {
    const candidates = slots.filter((s) => r.slots.includes(s));
    const pool = candidates.length ? candidates : [displaySlot(r, slots)];
    // Moment le moins chargé (départage par l'ordre des moments demandés).
    const best = pool.reduce((a, b) => ((count.get(b) ?? 0) < (count.get(a) ?? 0) ? b : a));
    count.set(best, (count.get(best) ?? 0) + 1);
    out.set(r.id, best);
  }
  return out;
}

export interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  costPerServing: number;
}

// Part équitable par portion = budget / (jours × moments × foyer). Sert de
// référence au scoring "prix" (une recette sous cette part marque mieux).
export function fairSharePerServing(prefs: UserPrefs, request: GenerationRequest): number {
  const slots = Math.max(1, requestedSlots(prefs).length);
  const servings = Math.max(1, WEEK_LEN * slots * prefs.householdSize);
  return request.budget / servings;
}

// ---- Passe 1 : filtres durs (sans budget : le budget est géré au niveau panier) ----
export function eligibleRecipes(
  recipes: Recipe[],
  prefs: UserPrefs,
  request: GenerationRequest,
): Recipe[] {
  const caps = userCapabilities(prefs.equipment);
  const excluded = new Set(prefs.excludedIngredients ?? []);
  const slots = requestedSlots(prefs);
  // Ambiance "Riche en protéines" -> on n'autorise que des repas >= seuil.
  const wantProtein = request.mealTypes.includes("proteine");
  return recipes.filter((r) => {
    const dietOk = prefs.dietTags.every((d) => r.dietTags.includes(d));
    const equipOk = r.reqCapabilities.every((c) => caps.has(c));
    const typeOk =
      request.mealTypes.length === 0 || r.mealTypes.some((t) => request.mealTypes.includes(t));
    // Allergènes / aliments à éviter : aucune recette contenant un ingrédient exclu.
    const excludeOk = excluded.size === 0 || !r.ingredients.some((ri) => excluded.has(ri.ingredientId));
    // Moment de la journée : la recette doit couvrir au moins un moment demandé.
    const slotOk = r.slots.some((s) => slots.includes(s));
    // Seuil protéines si l'ambiance protéinée est demandée — proportionné au
    // moment : une collation ne peut pas peser autant qu'un repas principal.
    const seuilProteines = r.slots.every((s) => s === "collation")
      ? PROTEIN_MIN_COLLATION
      : PROTEIN_MIN;
    const proteinOk = !wantProtein || r.nutrition.protein >= seuilProteines;
    return dietOk && equipOk && typeOk && excludeOk && slotOk && proteinOk;
  });
}

// ---- Passe 2 : scoring doux ----
const WEIGHTS = { type: 0.4, budget: 0.2, time: 0.2, variety: 0.2 };

// Bruit déterministe et stable dans [0,1) à partir d'une (id, seed). Sert la
// "variété" : à seed différent, classement différent — mais toujours reproductible.
function hashNoise(id: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // xorshift final pour mieux disperser
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}

export function scoreRecipe(
  recipe: Recipe,
  request: GenerationRequest,
  costPerServing: number,
  fairShare: number,
): number {
  const typeScore =
    request.mealTypes.length === 0
      ? 0.5
      : recipe.mealTypes.filter((t) => request.mealTypes.includes(t)).length /
        request.mealTypes.length;

  // Plus la portion est sous la part équitable, mieux c'est (aide à tenir le budget).
  const budgetScore = fairShare > 0 ? Math.max(0, Math.min(1, 1 - costPerServing / fairShare)) : 0;
  const timeScore = recipe.prepMinutes <= 25 ? 1 : 0;
  // Sans seed : score de variété neutre (comportement historique conservé).
  // Avec seed : bruit déterministe qui rebrasse les recettes ~équivalentes.
  const varietyScore = request.seed ? hashNoise(recipe.id, request.seed) : 0.5;

  return (
    WEIGHTS.type * typeScore +
    WEIGHTS.budget * budgetScore +
    WEIGHTS.time * timeScore +
    WEIGHTS.variety * varietyScore
  );
}

export function rankRecipes(
  recipes: Recipe[],
  prefs: UserPrefs,
  request: GenerationRequest,
  ingredientsById: Map<string, Ingredient>,
  store: Store,
  priceBook?: Map<string, number>,
): ScoredRecipe[] {
  const fairShare = fairSharePerServing(prefs, request);
  return eligibleRecipes(recipes, prefs, request)
    .map((recipe) => {
      const costPerServing = recipeCostPerServing(recipe, ingredientsById, store, priceBook);
      return { recipe, costPerServing, score: scoreRecipe(recipe, request, costPerServing, fairShare) };
    })
    .sort((a, b) => b.score - a.score || a.recipe.id.localeCompare(b.recipe.id));
}

// Un repas placé dans la semaine : quel jour (0 = Lundi), quel moment, quelle
// recette — et en quelle portion (1 = portion standard du catalogue ; ajustée
// quand une cible calorique est demandée, cf. lib/nutrition-target.ts).
export interface PlannedMeal {
  day: number; // 0..6 -> Lundi..Dimanche
  slot: MealSlot;
  recipe: Recipe;
  factor: number;
}

export interface WeekPlan {
  meals: PlannedMeal[]; // grille jour × moment
  recipes: Recipe[]; // liste plate (ordre par jour) pour la liste de courses
  portions: MealPortion[]; // même liste, avec le facteur de portion de chaque repas
  total: number; // coût réel du panier (au magasin) — DOIT être <= budget
  plannedDays: number; // nb de jours complets réellement générés
  targetDays: number; // nb de jours visés (borné par le budget)
  withinBudget: boolean; // a-t-on atteint le nb de jours visé ?
  eligibleCount: number;
}

// ---- Passe 3 : plan hebdo, JOUR par JOUR, sous contrainte de budget ----
// Pour chaque jour (Lundi -> Dimanche) on compose UNE recette par moment demandé.
// Un jour n'est retenu que s'il est COMPLET et que le panier agrégé (dédoublonné,
// produits entiers) reste <= budget.
//
// Politique de variété (2 passes) :
//   1) On privilégie des recettes DISTINCTES sur toute la semaine.
//   2) Si une file de moment est épuisée (peu de recettes éligibles à cause
//      des filtres régime/protéines), on autorise la RÉUTILISATION d'une recette
//      déjà servie plutôt que de bloquer la génération du reste de la semaine.
//      Ex : un seul petit-déj protéiné éligible -> il revient chaque jour au lieu
//      d'arrêter tout le plan.
// On s'arrête seulement quand aucune recette (même réutilisée) ne rentre dans
// le budget pour un moment donné.
export function planWeek(
  recipes: Recipe[],
  prefs: UserPrefs,
  request: GenerationRequest,
  ingredientsById: Map<string, Ingredient>,
  store: Store,
  priceBook?: Map<string, number>,
): WeekPlan {
  const ranked = rankRecipes(recipes, prefs, request, ingredientsById, store, priceBook);
  const slots = requestedSlots(prefs);

  // Cible du calculateur diète : calories (et protéines) visées PAR MOMENT.
  const target = request.nutrition;
  const kcalBySlot = target ? slotKcalTargets(target, slots) : null;
  const proteinBySlot = target
    ? new Map([...slotShares(slots)].map(([s, part]) => [s, target.proteinesG * part]))
    : null;

  // Portion servie pour un repas : 1 sans cible, ajustée sinon.
  const factorFor = (recipe: Recipe, slot: MealSlot): number =>
    kcalBySlot ? portionFactor(recipe.nutrition.kcal, kcalBySlot.get(slot) ?? 0) : 1;

  // Une file ordonnée par score et par moment : une recette figure dans chaque
  // moment qu'elle couvre. Avec une cible, on reclasse chaque file en mêlant le
  // score global (envies, prix, rapidité, variété) et l'affinité à la cible du
  // moment — sinon deux recettes également « bonnes » ignoreraient les calories.
  const bySlot = new Map<MealSlot, Recipe[]>(slots.map((s) => [s, []]));
  const scoreById = new Map(ranked.map((r) => [r.recipe.id, r.score]));
  for (const { recipe } of ranked) {
    for (const s of slots) {
      if (recipe.slots.includes(s)) bySlot.get(s)!.push(recipe);
    }
  }
  if (kcalBySlot && proteinBySlot) {
    for (const [slot, list] of bySlot) {
      const kcal = kcalBySlot.get(slot) ?? 0;
      const prot = proteinBySlot.get(slot) ?? 0;
      const blended = new Map(
        list.map((r) => [
          r.id,
          0.5 * targetAffinity(r, kcal, prot) + 0.5 * (scoreById.get(r.id) ?? 0),
        ]),
      );
      list.sort(
        (a, b) => (blended.get(b.id) ?? 0) - (blended.get(a.id) ?? 0) || a.id.localeCompare(b.id),
      );
    }
  }
  const usedIds = new Set<string>();
  const chosen: MealPortion[] = [];
  const meals: PlannedMeal[] = [];

  // Choisit la meilleure recette qui tient dans le budget pour un moment donné.
  // `allowReuse` = true autorise à re-piocher une recette déjà servie.
  function pickForSlot(
    slot: MealSlot,
    todayPicks: MealPortion[],
    allowReuse: boolean,
  ): MealPortion | null {
    const list = bySlot.get(slot)!;
    for (const cand of list) {
      // Toujours interdire de servir 2 fois la MÊME recette dans un même jour.
      if (todayPicks.some((p) => p.recipe.id === cand.id)) continue;
      if (!allowReuse && usedIds.has(cand.id)) continue;
      const portion: MealPortion = { recipe: cand, factor: factorFor(cand, slot) };
      const basket = [...chosen, ...todayPicks, portion];
      const total = buildShoppingList(basket, ingredientsById, prefs.householdSize, store, priceBook).total;
      if (total <= request.budget) return portion;
    }
    return null;
  }

  for (let day = 0; day < WEEK_LEN; day++) {
    // Composer un jour COMPLET : 1 recette par moment, panier <= budget.
    const dayPicks: MealPortion[] = [];
    const dayMeals: PlannedMeal[] = [];
    let complete = true;

    for (const slot of slots) {
      // Priorité aux recettes fraîches, sinon on autorise la réutilisation.
      const picked =
        pickForSlot(slot, dayPicks, false) ?? pickForSlot(slot, dayPicks, true);
      if (!picked) {
        complete = false;
        break;
      }
      dayPicks.push(picked);
      dayMeals.push({ day, slot, recipe: picked.recipe, factor: picked.factor });
    }

    if (!complete) break;

    for (const m of dayMeals) {
      chosen.push({ recipe: m.recipe, factor: m.factor });
      usedIds.add(m.recipe.id);
      meals.push(m);
    }
  }

  const total = buildShoppingList(chosen, ingredientsById, prefs.householdSize, store, priceBook).total;
  const plannedDays = new Set(meals.map((m) => m.day)).size;
  return {
    meals,
    recipes: chosen.map((p) => p.recipe),
    portions: chosen,
    total,
    plannedDays,
    targetDays: WEEK_LEN,
    withinBudget: plannedDays >= WEEK_LEN,
    eligibleCount: ranked.length,
  };
}

// Plan à partir d'une sélection fixée (après un swap) : conserve l'ordre demandé.
export function buildPlanFromIds(
  ids: string[],
  recipes: Recipe[],
): Recipe[] {
  return ids
    .map((id) => recipes.find((r) => r.id === id))
    .filter((r): r is Recipe => Boolean(r));
}

// Reconstruit une grille jour × moment depuis une liste plate (chemin "preset",
// après un swap). On assigne un moment à chaque recette (équilibrage), puis le
// k-ième repas d'un moment tombe le jour k. La portion est recalculée sur la
// cible du moment, pour qu'un repas échangé reste aligné sur les calories.
export function toDayGrid(
  recipes: Recipe[],
  selectedSlots: MealSlot[],
  target?: NutritionTarget,
): PlannedMeal[] {
  const slots = MEAL_SLOT_ORDER.filter((s) => selectedSlots.includes(s));
  const effective = slots.length ? slots : DEFAULT_SLOTS;
  const slotOf = assignSlots(recipes, effective);
  const kcalBySlot = target ? slotKcalTargets(target, effective) : null;
  const dayOf = new Map<MealSlot, number>();
  return recipes.map((r) => {
    const slot = slotOf.get(r.id) ?? effective[0];
    const day = dayOf.get(slot) ?? 0;
    dayOf.set(slot, day + 1);
    const factor = kcalBySlot
      ? portionFactor(r.nutrition.kcal, kcalBySlot.get(slot) ?? 0)
      : 1;
    return { day, slot, recipe: r, factor };
  });
}

// Meilleur substitut pour le swap : top-1 éligible hors sélection courante.
export function bestSubstitute(
  recipes: Recipe[],
  prefs: UserPrefs,
  request: GenerationRequest,
  ingredientsById: Map<string, Ingredient>,
  store: Store,
  currentIds: string[],
  priceBook?: Map<string, number>,
): Recipe | null {
  const ranked = rankRecipes(recipes, prefs, request, ingredientsById, store, priceBook).filter(
    (s) => !currentIds.includes(s.recipe.id),
  );
  return ranked[0]?.recipe ?? null;
}

// Substituts par MOMENT : pour chaque repas on veut un remplaçant qui sert le
// même moment et n'est pas déjà dans la semaine. On classe une fois, puis on
// pioche le meilleur candidat par moment.
export function slotSubstitutes(
  recipes: Recipe[],
  prefs: UserPrefs,
  request: GenerationRequest,
  ingredientsById: Map<string, Ingredient>,
  store: Store,
  usedIds: string[],
  priceBook?: Map<string, number>,
): (slot: MealSlot) => Recipe | null {
  const used = new Set(usedIds);
  const ranked = rankRecipes(recipes, prefs, request, ingredientsById, store, priceBook);
  return (slot: MealSlot) =>
    ranked.find((s) => s.recipe.slots.includes(slot) && !used.has(s.recipe.id))?.recipe ?? null;
}
