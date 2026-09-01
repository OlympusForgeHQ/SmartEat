import type { MealSlot, Recipe } from "./types";
import { MEAL_SLOT_ORDER } from "./labels";

// Cible nutritionnelle issue du calculateur diète (lib/diet-calculator.ts).
// Le plan de la semaine s'y aligne : on choisit les recettes les plus proches
// de la cible du moment, puis on AJUSTE LA PORTION pour atteindre les calories.
//
// Pourquoi ajuster la portion : le catalogue tient dans ~360-600 kcal/portion.
// Trois repas « une portion » plafonnent vers 1 500 kcal/jour, très en dessous
// d'une cible masculine typique (2 000-2 500). Servir 1,4 portion du même plat
// est la façon honnête — et cuisinable — de combler l'écart, et les quantités
// de la liste de courses suivent le même facteur.

export interface NutritionTarget {
  kcal: number;
  proteinesG: number;
  glucidesG: number;
  lipidesG: number;
}

// Répartition des calories sur la journée (classique en diététique).
// Renormalisée sur les seuls moments que l'utilisateur planifie.
const SLOT_SHARE: Record<MealSlot, number> = {
  petit_dej: 0.25,
  dejeuner: 0.4,
  diner: 0.35,
};

// Bornes de portion : en deçà on ne mange plus, au-delà l'assiette n'est plus
// réaliste. Le pas de 0,1 garde un affichage lisible (« ×1,4 portion »).
export const PORTION_MIN = 0.5;
export const PORTION_MAX = 2;
const PORTION_STEP = 0.1;

/** Part des calories quotidiennes revenant à chaque moment planifié. */
export function slotShares(slots: MealSlot[]): Map<MealSlot, number> {
  const used = MEAL_SLOT_ORDER.filter((s) => slots.includes(s));
  const effective = used.length ? used : (["dejeuner", "diner"] as MealSlot[]);
  const sum = effective.reduce((t, s) => t + SLOT_SHARE[s], 0);
  return new Map(effective.map((s) => [s, SLOT_SHARE[s] / sum]));
}

/** Calories visées pour chaque moment de la journée. */
export function slotKcalTargets(
  target: NutritionTarget,
  slots: MealSlot[],
): Map<MealSlot, number> {
  const shares = slotShares(slots);
  return new Map([...shares].map(([slot, share]) => [slot, target.kcal * share]));
}

/**
 * Facteur de portion pour rapprocher une recette des calories visées.
 * Arrondi au dixième et borné : la portion reste mangeable.
 */
export function portionFactor(recipeKcal: number, slotKcal: number): number {
  if (!(recipeKcal > 0) || !(slotKcal > 0)) return 1;
  const raw = slotKcal / recipeKcal;
  const stepped = Math.round(raw / PORTION_STEP) * PORTION_STEP;
  return Math.min(PORTION_MAX, Math.max(PORTION_MIN, Number(stepped.toFixed(1))));
}

/**
 * Affinité d'une recette avec la cible d'un moment, dans [0,1].
 * - `fit` : moins il faut étirer la portion, mieux c'est (facteur proche de 1).
 * - `protein` : à calories égales, on préfère la recette qui couvre les
 *   protéines du moment (la cible protéique du calculateur est fixe, 2 g/kg).
 */
export function targetAffinity(
  recipe: Recipe,
  slotKcal: number,
  slotProteinG: number,
): number {
  const factor = portionFactor(recipe.nutrition.kcal, slotKcal);
  const fit = 1 - Math.min(1, Math.abs(factor - 1));
  const protein =
    slotProteinG > 0
      ? Math.min(1, (recipe.nutrition.protein * factor) / slotProteinG)
      : 0.5;
  return 0.5 * fit + 0.5 * protein;
}

export interface ScaledMeal {
  recipe: Recipe;
  factor: number;
}

/** Totaux réels d'une journée, facteurs de portion appliqués. */
export function dayTotals(meals: ScaledMeal[]): NutritionTarget {
  return meals.reduce<NutritionTarget>(
    (t, { recipe, factor }) => ({
      kcal: t.kcal + recipe.nutrition.kcal * factor,
      proteinesG: t.proteinesG + recipe.nutrition.protein * factor,
      glucidesG: t.glucidesG + recipe.nutrition.carbs * factor,
      lipidesG: t.lipidesG + recipe.nutrition.fat * factor,
    }),
    { kcal: 0, proteinesG: 0, glucidesG: 0, lipidesG: 0 },
  );
}

/** Écart relatif à la cible, signé (+ au-dessus, − en dessous). */
export function kcalGap(atteint: number, cible: number): number {
  return cible > 0 ? (atteint - cible) / cible : 0;
}

// Tolérance d'affichage : en deçà, le plan est considéré « dans la cible ».
export const KCAL_TOLERANCE = 0.1;

/* ------------------------------------------------------------------ */
/*  Transport : la cible voyage dans l'URL (calculateur -> plan -> liste) */
/* ------------------------------------------------------------------ */

// Bornes de sûreté : au-delà, la « cible » ne vient plus d'un calcul sérieux
// (URL bricolée). On refuse plutôt que de générer un plan absurde.
const KCAL_MIN = 800;
const KCAL_MAX = 6000;

function macro(raw: string | undefined, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : 0;
}

/** Lit une cible depuis les paramètres d'URL. Renvoie undefined si absente/aberrante. */
export function parseTarget(params: {
  kcal?: string;
  prot?: string;
  gluc?: string;
  lip?: string;
}): NutritionTarget | undefined {
  const kcal = Number(params.kcal);
  if (!Number.isFinite(kcal) || kcal < KCAL_MIN || kcal > KCAL_MAX) return undefined;
  return {
    kcal: Math.round(kcal),
    proteinesG: macro(params.prot, 500),
    glucidesG: macro(params.gluc, 1000),
    lipidesG: macro(params.lip, 500),
  };
}

/** Sérialise une cible pour un lien (plan, liste, régénération). */
export function targetParams(target: NutritionTarget | undefined): Record<string, string> {
  if (!target) return {};
  return {
    kcal: String(Math.round(target.kcal)),
    prot: String(Math.round(target.proteinesG)),
    gluc: String(Math.round(target.glucidesG)),
    lip: String(Math.round(target.lipidesG)),
  };
}
