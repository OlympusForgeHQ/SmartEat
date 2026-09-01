import { describe, expect, it } from "vitest";
import type { MealSlot, Recipe } from "./types";
import {
  dayTotals,
  kcalGap,
  PORTION_MAX,
  PORTION_MIN,
  portionFactor,
  slotKcalTargets,
  slotShares,
  targetAffinity,
  type NutritionTarget,
} from "./nutrition-target";

// Cible de référence : profil Homme du classeur Diet Legacy, semaine 1
// (178 cm / 80 kg / 36 ans, coefficient 1,45, déficit 10 %).
const CIBLE: NutritionTarget = { kcal: 2199, proteinesG: 160, glucidesG: 244, lipidesG: 65 };

function recette(kcal: number, protein: number, id = "r"): Recipe {
  return {
    id,
    title: "Test",
    emoji: "🍽️",
    mealTypes: [],
    slots: ["dejeuner"],
    dietTags: [],
    reqCapabilities: [],
    prepMinutes: 20,
    defaultServings: 2,
    ingredients: [],
    steps: [],
    nutrition: { kcal, protein, carbs: 40, fat: 15 },
  };
}

describe("répartition des calories sur la journée", () => {
  it("garde les parts standard sur trois repas et somme à 1", () => {
    const parts = slotShares(["petit_dej", "dejeuner", "diner"]);
    expect(parts.get("petit_dej")).toBeCloseTo(0.25, 5);
    expect(parts.get("dejeuner")).toBeCloseTo(0.4, 5);
    expect(parts.get("diner")).toBeCloseTo(0.35, 5);
    expect([...parts.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it("renormalise quand un moment n'est pas planifié", () => {
    const parts = slotShares(["dejeuner", "diner"]);
    expect([...parts.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(parts.get("dejeuner")).toBeCloseTo(0.4 / 0.75, 5);
    expect(parts.has("petit_dej")).toBe(false);
  });

  it("ajoute la collation sans dénaturer les trois repas", () => {
    const parts = slotShares(["petit_dej", "dejeuner", "collation", "diner"]);
    expect([...parts.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    // La collation reste le plus petit moment de la journée.
    const collation = parts.get("collation")!;
    for (const s of ["petit_dej", "dejeuner", "diner"] as const) {
      expect(collation).toBeLessThan(parts.get(s)!);
    }
    // Les trois repas gardent leurs proportions relatives (0,25 / 0,40 / 0,35).
    expect(parts.get("dejeuner")! / parts.get("petit_dej")!).toBeCloseTo(0.4 / 0.25, 5);
    expect(parts.get("diner")! / parts.get("petit_dej")!).toBeCloseTo(0.35 / 0.25, 5);
  });

  it("retombe sur midi + soir si aucun moment n'est fourni", () => {
    const parts = slotShares([]);
    expect([...parts.keys()]).toEqual(["dejeuner", "diner"]);
  });

  it("répartit les calories de la cible sans en perdre", () => {
    const slots: MealSlot[] = ["petit_dej", "dejeuner", "diner"];
    const cibles = slotKcalTargets(CIBLE, slots);
    expect([...cibles.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(CIBLE.kcal, 3);
    expect(cibles.get("dejeuner")).toBeCloseTo(2199 * 0.4, 3);
  });
});

describe("facteur de portion", () => {
  it("vaut 1 quand la recette tombe déjà sur la cible", () => {
    expect(portionFactor(500, 500)).toBe(1);
  });

  it("étire la portion quand la recette est trop légère (arrondi au dixième)", () => {
    // Cible déjeuner 880 kcal, recette 500 -> 1,76 arrondi à 1,8
    expect(portionFactor(500, 880)).toBe(1.8);
  });

  it("réduit la portion quand la recette est trop riche", () => {
    expect(portionFactor(700, 550)).toBeCloseTo(0.8, 5);
  });

  it("reste dans des portions mangeables", () => {
    expect(portionFactor(200, 2000)).toBe(PORTION_MAX);
    expect(portionFactor(900, 200)).toBe(PORTION_MIN);
  });

  it("ne divise jamais par zéro", () => {
    expect(portionFactor(0, 600)).toBe(1);
    expect(portionFactor(500, 0)).toBe(1);
  });
});

describe("affinité avec la cible", () => {
  it("préfère la recette qui demande le moins d'étirement", () => {
    const proche = targetAffinity(recette(600, 40), 600, 45);
    const loin = targetAffinity(recette(300, 20), 600, 45);
    expect(proche).toBeGreaterThan(loin);
  });

  it("départage deux recettes iso-calories par les protéines", () => {
    const proteinee = targetAffinity(recette(500, 45), 500, 45);
    const pauvre = targetAffinity(recette(500, 10), 500, 45);
    expect(proteinee).toBeGreaterThan(pauvre);
    expect(proteinee).toBeLessThanOrEqual(1);
    expect(pauvre).toBeGreaterThanOrEqual(0);
  });
});

describe("totaux du jour", () => {
  it("applique les facteurs de portion à toutes les macros", () => {
    const totaux = dayTotals([
      { recipe: recette(500, 40, "a"), factor: 1.5 },
      { recipe: recette(400, 30, "b"), factor: 1 },
    ]);
    expect(totaux.kcal).toBeCloseTo(1150, 5);
    expect(totaux.proteinesG).toBeCloseTo(90, 5);
    expect(totaux.glucidesG).toBeCloseTo(40 * 1.5 + 40, 5);
    expect(totaux.lipidesG).toBeCloseTo(15 * 1.5 + 15, 5);
  });

  it("rend une journée vide sans planter", () => {
    expect(dayTotals([])).toEqual({ kcal: 0, proteinesG: 0, glucidesG: 0, lipidesG: 0 });
  });

  it("approche la cible du classeur sur une journée réaliste", () => {
    const slots: MealSlot[] = ["petit_dej", "dejeuner", "diner"];
    const cibles = slotKcalTargets(CIBLE, slots);
    const jour = [
      { kcal: 420, prot: 30, slot: "petit_dej" as MealSlot },
      { kcal: 520, prot: 45, slot: "dejeuner" as MealSlot },
      { kcal: 480, prot: 40, slot: "diner" as MealSlot },
    ].map(({ kcal, prot, slot }) => ({
      recipe: recette(kcal, prot),
      factor: portionFactor(kcal, cibles.get(slot)!),
    }));
    const totaux = dayTotals(jour);
    expect(Math.abs(kcalGap(totaux.kcal, CIBLE.kcal))).toBeLessThan(0.05);
  });
});

describe("écart à la cible", () => {
  it("est signé et relatif", () => {
    expect(kcalGap(2300, 2200)).toBeCloseTo(0.0454, 3);
    expect(kcalGap(2100, 2200)).toBeLessThan(0);
    expect(kcalGap(2200, 0)).toBe(0);
  });
});
