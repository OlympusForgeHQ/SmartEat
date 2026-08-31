import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LEVELS,
  AJUSTEMENTS,
  basalMetabolicRate,
  buildDietPlan,
  inputValide,
  leanBodyMass,
} from "./diet-calculator";

// Valeurs de référence relevées dans le classeur Google Sheets
// « Calculateur Diet Legacy » (copie du 2026-08-30). Chaque profil ci-dessous
// reproduit un onglet du classeur, à la kcal et au gramme près.

describe("masse maigre (Boer) et BMR (Katch-McArdle)", () => {
  it("reproduit les cellules du classeur", () => {
    expect(leanBodyMass("homme", 178, 80)).toBeCloseTo(60.886, 3);
    expect(leanBodyMass("femme", 177, 88)).toBeCloseTo(57.597, 3);
    expect(leanBodyMass("homme", 180, 86)).toBeCloseTo(63.862, 3);
    expect(Math.round(basalMetabolicRate(60.886))).toBe(1685);
    expect(Math.round(basalMetabolicRate(57.597))).toBe(1614);
    expect(Math.round(basalMetabolicRate(63.862))).toBe(1749);
  });

  it("reproduit même la cellule vide du classeur (constante -48,3 femme)", () => {
    // Onglet Femme sans mesures : le classeur affiche LBM -48,3 et BMR -673.
    expect(leanBodyMass("femme", 0, 0)).toBeCloseTo(-48.3, 3);
    expect(Math.round(basalMetabolicRate(-48.3))).toBe(-673);
  });
});

describe("plan perte de poids (8 semaines, -1 %/sem)", () => {
  it("onglet Homme : 178 cm / 80 kg / 36 ans, coeff 1,45, déficit 10 %", () => {
    const plan = buildDietPlan({
      sexe: "homme",
      tailleCm: 178,
      poidsKg: 80,
      age: 36,
      coefficient: 1.45,
      objectif: "perte",
      ajustement: 0.1,
      preference: "aucune",
    });
    expect(plan.bmr).toBe(1685);
    expect(plan.tdee).toBe(2443);
    expect(plan.semaines.map((s) => s.kcal)).toEqual([
      2199, 2177, 2155, 2134, 2112, 2091, 2070, 2050,
    ]);
    expect(plan.semaines.every((s) => s.proteinesG === 160)).toBe(true);
    expect(plan.semaines.map((s) => s.glucidesG)).toEqual([
      244, 240, 237, 233, 230, 227, 224, 220,
    ]);
    expect(plan.semaines.map((s) => s.lipidesG)).toEqual([65, 64, 63, 62, 61, 60, 60, 59]);
    expect(plan.macrosEcretees).toBe(false);
  });

  it("onglet Femme : 177 cm / 88 kg / 29 ans, coeff 1,2, déficit 10 %", () => {
    const plan = buildDietPlan({
      sexe: "femme",
      tailleCm: 177,
      poidsKg: 88,
      age: 29,
      coefficient: 1.2,
      objectif: "perte",
      ajustement: 0.1,
      preference: "aucune",
    });
    expect(plan.bmr).toBe(1614);
    expect(plan.tdee).toBe(1937);
    expect(plan.semaines.map((s) => s.kcal)).toEqual([
      1743, 1726, 1709, 1691, 1675, 1658, 1641, 1625,
    ]);
    expect(plan.semaines.every((s) => s.proteinesG === 176)).toBe(true);
    expect(plan.semaines.map((s) => s.glucidesG)).toEqual([
      162, 160, 157, 154, 152, 149, 146, 144,
    ]);
    expect(plan.semaines.map((s) => s.lipidesG)).toEqual([43, 43, 42, 41, 40, 40, 39, 38]);
  });

  it("onglet Homme (classeur d'origine) : 180 cm / 86 kg / 37 ans, coeff 1,4, déficit 12,5 %", () => {
    const plan = buildDietPlan({
      sexe: "homme",
      tailleCm: 180,
      poidsKg: 86,
      age: 37,
      coefficient: 1.4,
      objectif: "perte",
      ajustement: 0.125,
      preference: "aucune",
    });
    expect(plan.bmr).toBe(1749);
    expect(plan.tdee).toBe(2449);
    expect(plan.semaines.map((s) => s.kcal)).toEqual([
      2143, 2122, 2100, 2079, 2059, 2038, 2018, 1997,
    ]);
    expect(plan.semaines.every((s) => s.proteinesG === 172)).toBe(true);
    expect(plan.semaines[0]).toMatchObject({ glucidesG: 227, lipidesG: 61 });
    expect(plan.semaines[7]).toMatchObject({ glucidesG: 205, lipidesG: 55 });
  });
});

describe("plan prise de poids (9 semaines, +2 %/sem)", () => {
  it("démarre au TDEE sans surplus et progresse de 1,02^8 (onglets Secours)", () => {
    const plan = buildDietPlan({
      sexe: "homme",
      tailleCm: 178,
      poidsKg: 75,
      age: 28,
      coefficient: 1.4,
      objectif: "prise",
      ajustement: 0,
      preference: "aucune",
    });
    expect(plan.semaines).toHaveLength(9);
    expect(plan.semaines[0].kcal).toBe(plan.tdee);
    // Le classeur (Secours homme/femme) montre S9/S1 = 1,02^8 = 1,1717.
    expect(plan.semaines[8].kcal / plan.semaines[0].kcal).toBeCloseTo(1.02 ** 8, 3);
    expect(plan.semaines.every((s) => s.proteinesG === 150)).toBe(true);
  });

  it("applique le surplus supplémentaire dès la semaine 1", () => {
    const base = { sexe: "homme" as const, tailleCm: 178, poidsKg: 75, age: 28 };
    const sans = buildDietPlan({
      ...base,
      coefficient: 1.4,
      objectif: "prise",
      ajustement: 0,
      preference: "aucune",
    });
    const avec = buildDietPlan({
      ...base,
      coefficient: 1.4,
      objectif: "prise",
      ajustement: 0.05,
      preference: "aucune",
    });
    expect(avec.semaines[0].kcal).toBeGreaterThan(sans.semaines[0].kcal);
    expect(avec.semaines[0].kcal / sans.semaines[0].kcal).toBeCloseTo(1.05, 2);
  });
});

describe("préférence alimentaire (répartition du reste kcal)", () => {
  const base = {
    sexe: "homme" as const,
    tailleCm: 178,
    poidsKg: 80,
    age: 36,
    coefficient: 1.45,
    objectif: "perte" as const,
    ajustement: 0.1,
  };

  it("« aucune » répartit 62,5 % glucides / 37,5 % lipides (vérifié classeur)", () => {
    const s1 = buildDietPlan({ ...base, preference: "aucune" }).semaines[0];
    expect(s1.glucidesG).toBe(244);
    expect(s1.lipidesG).toBe(65);
  });

  it("« glucides » monte les glucides, « lipides » monte les lipides, kcal inchangées", () => {
    const gl = buildDietPlan({ ...base, preference: "glucides" }).semaines[0];
    const li = buildDietPlan({ ...base, preference: "lipides" }).semaines[0];
    const au = buildDietPlan({ ...base, preference: "aucune" }).semaines[0];
    expect(gl.kcal).toBe(au.kcal);
    expect(li.kcal).toBe(au.kcal);
    expect(gl.glucidesG).toBeGreaterThan(au.glucidesG);
    expect(gl.lipidesG).toBeLessThan(au.lipidesG);
    expect(li.lipidesG).toBeGreaterThan(au.lipidesG);
    expect(li.glucidesG).toBeLessThan(au.glucidesG);
    // Les protéines ne bougent jamais avec la préférence.
    expect(gl.proteinesG).toBe(160);
    expect(li.proteinesG).toBe(160);
  });
});

describe("garde-fous", () => {
  it("écrête les macros quand les protéines dépassent les kcal du jour", () => {
    // Profil extrême : les kcal de fin de plan passent sous les kcal protéines.
    const plan = buildDietPlan({
      sexe: "femme",
      tailleCm: 150,
      poidsKg: 250,
      age: 40,
      coefficient: 1.2,
      objectif: "perte",
      ajustement: 0.2,
      preference: "aucune",
    });
    expect(plan.macrosEcretees).toBe(true);
    const derniere = plan.semaines[plan.semaines.length - 1];
    expect(derniere.glucidesG).toBe(0);
    expect(derniere.lipidesG).toBe(0);
  });

  it("valide les bornes de saisie", () => {
    expect(inputValide({ tailleCm: 178, poidsKg: 80, age: 36 })).toBe(true);
    expect(inputValide({ tailleCm: 90, poidsKg: 80, age: 36 })).toBe(false);
    expect(inputValide({ tailleCm: 178, poidsKg: 20, age: 36 })).toBe(false);
    expect(inputValide({ tailleCm: 178, poidsKg: 80, age: 8 })).toBe(false);
    expect(inputValide({ tailleCm: Number.NaN, poidsKg: 80, age: 36 })).toBe(false);
  });

  it("expose les 5 coefficients et les 8 ajustements du classeur", () => {
    expect(ACTIVITY_LEVELS.map((a) => a.coefficient)).toEqual([1.2, 1.3, 1.35, 1.4, 1.45]);
    expect(AJUSTEMENTS).toEqual([0, 0.05, 0.075, 0.1, 0.125, 0.15, 0.175, 0.2]);
  });
});
