import { describe, expect, it } from "vitest";
import { INGREDIENTS, RECIPES, STORES } from "@/db/seed-data";
import { PROTEIN_MIN, PROTEIN_MIN_COLLATION } from "./labels";
import { canCook } from "./capabilities";
import { eligibleRecipes, planWeek } from "./matching-engine";
import { recipeCostPerServing } from "./pricing";
import type { GenerationRequest, Ingredient, UserPrefs } from "./types";

const ingredientsById = new Map<string, Ingredient>(INGREDIENTS.map((i) => [i.id, i]));
const store = STORES.find((s) => s.id === "fr_carrefour")!; // priceFactor 1.0

const basePrefs: UserPrefs = {
  country: "FR",
  storeId: "fr_carrefour",
  dietTags: [],
  equipment: ["four", "airfryer", "micro", "poele"],
  householdSize: 2,
  mealsPerWeek: 5,
  budget: 35,
  ambiance: [],
  mealSlots: ["petit_dej", "dejeuner", "diner"],
};

const wideRequest: GenerationRequest = { budget: 200, mealTypes: [] };

describe("Recipe Matching Engine — combinatoire intelligente", () => {
  it("exclut une recette Four-only si l'utilisateur n'a qu'un Air Fryer", () => {
    const prefs: UserPrefs = { ...basePrefs, equipment: ["airfryer"] };
    const eligible = eligibleRecipes(RECIPES, prefs, wideRequest);
    expect(eligible.find((r) => r.id === "r06")).toBeUndefined(); // gratin -> Four only
    expect(eligible.find((r) => r.id === "r01")).toBeDefined(); // roast -> Air Fryer ok
  });

  it("Four ET Air Fryer couvrent tous deux `roast` (substitution gratuite)", () => {
    expect(canCook(["roast"], ["four"])).toBe(true);
    expect(canCook(["roast"], ["airfryer"])).toBe(true);
    expect(canCook(["simmer"], ["four"])).toBe(false);
  });

  it("Poêle seule exclut rôti, gratin et vapeur", () => {
    const prefs: UserPrefs = { ...basePrefs, equipment: ["poele"] };
    const ids = eligibleRecipes(RECIPES, prefs, wideRequest).map((r) => r.id);
    expect(ids).not.toContain("r01"); // roast
    expect(ids).not.toContain("r06"); // gratin
    expect(ids).not.toContain("r02"); // steam
    expect(ids).toContain("r03"); // simmer ok
  });

  it("applique le régime par inclusion (tous les tags requis)", () => {
    const prefs: UserPrefs = { ...basePrefs, dietTags: ["vegan", "sans_gluten"] };
    const eligible = eligibleRecipes(RECIPES, prefs, wideRequest);
    expect(
      eligible.every((r) => r.dietTags.includes("vegan") && r.dietTags.includes("sans_gluten")),
    ).toBe(true);
    expect(eligible.find((r) => r.id === "r04")).toBeUndefined(); // bolognaise (viande, gluten)
  });

  it("exclut les recettes contenant un aliment à éviter (allergène/dégoût)", () => {
    const prefs: UserPrefs = { ...basePrefs, excludedIngredients: ["salmon", "cod", "tuna_canned"] };
    const eligible = eligibleRecipes(RECIPES, prefs, wideRequest);
    // r02 & r13 contiennent du saumon -> exclues.
    expect(eligible.find((r) => r.id === "r02")).toBeUndefined();
    expect(eligible.find((r) => r.id === "r13")).toBeUndefined();
    // aucune recette éligible ne contient un ingrédient exclu.
    const banned = new Set(prefs.excludedIngredients);
    expect(eligible.every((r) => !r.ingredients.some((i) => banned.has(i.ingredientId)))).toBe(true);
  });

  it("le coût d'une recette suit le profil de prix du magasin", () => {
    const bio = STORES.find((s) => s.id === "fr_biocoop")!;
    const r = RECIPES.find((x) => x.id === "r03")!;
    const atCarrefour = recipeCostPerServing(r, ingredientsById, store);
    const atBio = recipeCostPerServing(r, ingredientsById, bio);
    expect(atBio).toBeCloseTo(atCarrefour * (bio.priceFactor / store.priceFactor), 5);
  });

  it("planWeek garantit que le panier de la semaine reste <= budget", () => {
    const plan = planWeek(RECIPES, basePrefs, { budget: 60, mealTypes: [] }, ingredientsById, store);
    expect(plan.total).toBeLessThanOrEqual(60 + 0.001);
    // Au plus 7 jours × nb de moments demandés.
    expect(plan.plannedDays).toBeLessThanOrEqual(7);
    expect(plan.recipes.length).toBeLessThanOrEqual(7 * basePrefs.mealSlots.length);
  });

  it("recettes uniques quand la variété est disponible (budget large)", () => {
    // Avec budget large et pool de recettes large, chaque repas doit être unique.
    const plan = planWeek(RECIPES, basePrefs, { budget: 300, mealTypes: [] }, ingredientsById, store);
    expect(plan.plannedDays).toBeGreaterThan(0);
    expect(new Set(plan.recipes.map((r) => r.id)).size).toBe(plan.recipes.length);
  });

  it("réutilise une recette si un moment a un pool épuisé (au lieu de bloquer)", () => {
    // Petit-déj + protéiné ≥ 35g : très peu de recettes éligibles.
    // Le plan doit continuer à générer des jours (avec réutilisation) au lieu
    // de s'arrêter à 1 jour.
    const prefs: UserPrefs = { ...basePrefs, mealSlots: ["petit_dej", "dejeuner"], householdSize: 1 };
    const plan = planWeek(
      RECIPES,
      prefs,
      { budget: 100, mealTypes: ["proteine"] },
      ingredientsById,
      store,
    );
    // Doit couvrir plusieurs jours, pas se bloquer à 1.
    expect(plan.plannedDays).toBeGreaterThan(1);
    // Le panier reste sous le budget.
    expect(plan.total).toBeLessThanOrEqual(100 + 0.001);
  });

  it("chaque jour généré est COMPLET (un repas par moment demandé)", () => {
    const prefs: UserPrefs = { ...basePrefs, mealSlots: ["dejeuner", "diner"] };
    const plan = planWeek(RECIPES, prefs, { budget: 120, mealTypes: [] }, ingredientsById, store);
    expect(plan.plannedDays).toBeGreaterThan(0);
    // Regroupe par jour : chaque jour a exactement un déjeuner et un dîner.
    const byDay = new Map<number, string[]>();
    for (const m of plan.meals) byDay.set(m.day, [...(byDay.get(m.day) ?? []), m.slot]);
    for (const slots of byDay.values()) {
      expect(slots.sort()).toEqual(["dejeuner", "diner"]);
    }
  });

  it("un budget plus serré ne sélectionne pas plus de repas", () => {
    const tight = planWeek(RECIPES, basePrefs, { budget: 40, mealTypes: [] }, ingredientsById, store);
    const loose = planWeek(RECIPES, basePrefs, { budget: 120, mealTypes: [] }, ingredientsById, store);
    expect(tight.recipes.length).toBeLessThanOrEqual(loose.recipes.length);
    expect(tight.total).toBeLessThanOrEqual(40 + 0.001);
  });

  it("la graine de variété (régénérer) reste déterministe et sous budget", () => {
    const a = planWeek(RECIPES, basePrefs, { budget: 60, mealTypes: [], seed: 1 }, ingredientsById, store);
    const aBis = planWeek(RECIPES, basePrefs, { budget: 60, mealTypes: [], seed: 1 }, ingredientsById, store);
    // Déterministe à seed égal.
    expect(a.recipes.map((r) => r.id)).toEqual(aBis.recipes.map((r) => r.id));
    // Toujours sous budget, quelle que soit la graine.
    expect(a.total).toBeLessThanOrEqual(60 + 0.001);
  });

  it("régénérer avec une autre graine produit une sélection différente sous budget", () => {
    const seeds = [1, 2, 3, 4, 5].map(
      (s) => planWeek(RECIPES, basePrefs, { budget: 80, mealTypes: [], seed: s }, ingredientsById, store),
    );
    // Toutes restent valides (sous budget).
    for (const p of seeds) expect(p.total).toBeLessThanOrEqual(80 + 0.001);
    // Au moins deux graines donnent une sélection distincte (variété réelle).
    const sigs = new Set(seeds.map((p) => p.recipes.map((r) => r.id).sort().join(",")));
    expect(sigs.size).toBeGreaterThan(1);
  });

  it("ne propose que des recettes du moment demandé (petit-déj seul)", () => {
    const prefs: UserPrefs = { ...basePrefs, mealSlots: ["petit_dej"] };
    const eligible = eligibleRecipes(RECIPES, prefs, wideRequest);
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.every((r) => r.slots.includes("petit_dej"))).toBe(true);
    // Un plat de dîner pur (ex. bolognaise) ne doit jamais apparaître au petit-déj.
    expect(eligible.find((r) => r.id === "r04")).toBeUndefined();
  });

  it("ambiance protéinée : chaque repas retenu atteint le seuil de protéines", () => {
    const prefs: UserPrefs = { ...basePrefs, mealSlots: ["dejeuner", "diner"] };
    const request: GenerationRequest = { budget: 200, mealTypes: ["proteine"] };
    const eligible = eligibleRecipes(RECIPES, prefs, request);
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.every((r) => r.nutrition.protein >= PROTEIN_MIN)).toBe(true);
    const plan = planWeek(RECIPES, prefs, request, ingredientsById, store);
    expect(plan.recipes.every((r) => r.nutrition.protein >= PROTEIN_MIN)).toBe(true);
  });

  it("chaque jour couvre tous les moments demandés (petit-déj + déjeuner)", () => {
    const prefs: UserPrefs = { ...basePrefs, mealSlots: ["petit_dej", "dejeuner"] };
    const plan = planWeek(RECIPES, prefs, { budget: 120, mealTypes: [] }, ingredientsById, store);
    const slots = plan.meals.map((m) => m.slot);
    // Les deux moments sont représentés, et chaque jour les a tous les deux.
    expect(slots).toContain("petit_dej");
    expect(slots).toContain("dejeuner");
    const byDay = new Map<number, Set<string>>();
    for (const m of plan.meals) byDay.set(m.day, (byDay.get(m.day) ?? new Set()).add(m.slot));
    for (const set of byDay.values()) {
      expect(set.has("petit_dej") && set.has("dejeuner")).toBe(true);
    }
  });
});

describe("Moment collation", () => {
  const prefsAvecCollation: UserPrefs = {
    ...basePrefs,
    mealSlots: ["petit_dej", "dejeuner", "collation", "diner"],
  };

  it("le catalogue propose des collations, toutes légères", () => {
    const collations = RECIPES.filter((r) => r.slots.includes("collation"));
    expect(collations.length).toBeGreaterThanOrEqual(10);
    for (const r of collations) {
      // Une collation reste un en-cas : jamais le poids d'un repas principal.
      expect(r.nutrition.kcal).toBeLessThanOrEqual(400);
      expect(r.nutrition.kcal).toBeGreaterThan(100);
      // Elles ne servent que le goûter (le petit-déj a son propre catalogue).
      expect(r.slots).toEqual(["collation"]);
    }
  });

  it("reste des collations éligibles même avec l'ambiance « Riche en protéines »", () => {
    const request: GenerationRequest = { budget: 200, mealTypes: ["proteine"] };
    const eligible = eligibleRecipes(RECIPES, prefsAvecCollation, request);
    const collations = eligible.filter((r) => r.slots.includes("collation"));
    expect(collations.length).toBeGreaterThan(0);
    // Le seuil appliqué est celui d'une collation, pas celui d'un repas.
    for (const r of collations) {
      expect(r.nutrition.protein).toBeGreaterThanOrEqual(PROTEIN_MIN_COLLATION);
      expect(r.nutrition.protein).toBeLessThan(PROTEIN_MIN);
    }
  });

  it("planifie quatre repas par jour quand la collation est demandée", () => {
    const plan = planWeek(
      RECIPES,
      prefsAvecCollation,
      { budget: 400, mealTypes: [] },
      ingredientsById,
      store,
    );
    expect(plan.plannedDays).toBeGreaterThan(0);
    const jour0 = plan.meals.filter((m) => m.day === 0);
    expect(jour0).toHaveLength(4);
    expect(jour0.map((m) => m.slot)).toContain("collation");
    // Le repas placé en collation vient bien du catalogue collation.
    const collation = jour0.find((m) => m.slot === "collation")!;
    expect(collation.recipe.slots).toContain("collation");
  });

  it("une cible calorique donne une collation plus légère que le dîner", () => {
    const plan = planWeek(
      RECIPES,
      prefsAvecCollation,
      {
        budget: 400,
        mealTypes: [],
        nutrition: { kcal: 2199, proteinesG: 160, glucidesG: 244, lipidesG: 65 },
      },
      ingredientsById,
      store,
    );
    const jour0 = plan.meals.filter((m) => m.day === 0);
    const kcal = (slot: string) => {
      const m = jour0.find((x) => x.slot === slot)!;
      return m.recipe.nutrition.kcal * m.factor;
    };
    expect(kcal("collation")).toBeLessThan(kcal("diner"));
    expect(kcal("collation")).toBeLessThan(kcal("dejeuner"));
  });
});
