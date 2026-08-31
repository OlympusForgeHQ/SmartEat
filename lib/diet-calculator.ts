// Calculateur Diet Legacy — portage fidèle du classeur Google Sheets
// « Calculateur Diet Legacy » (onglets Homme / Femme).
//
// Chaîne de calcul du classeur, vérifiée à la kcal près sur trois profils
// complets (Homme 178/80/36 ×1,45 déficit 10 % ; Femme 177/88/29 ×1,2
// déficit 10 % ; Homme 180/86/37 ×1,4 déficit 12,5 %) :
//
//   1. Masse maigre (LBM), formule de Boer :
//        homme : 0,407 × poids + 0,267 × taille − 19,2
//        femme : 0,252 × poids + 0,473 × taille − 48,3
//   2. Métabolisme de base (BMR), Katch-McArdle : 370 + 21,6 × LBM
//      (l'âge est demandé par la fiche mais n'entre pas dans cette formule)
//   3. TDEE = BMR × coefficient d'activité (1,2 → 1,45)
//   4. Plan hebdomadaire :
//        perte  : 8 semaines, S1 = TDEE × (1 − ajustement), puis −1 %/sem
//        prise  : 9 semaines, S1 = TDEE × (1 + ajustement), puis +2 %/sem
//      Précision conservée d'une semaine à l'autre, arrondi à l'affichage.
//   5. Macros : protéines fixes à 2 g/kg de poids de corps ; le reste des
//      kcal est réparti glucides/lipides selon la préférence alimentaire.
//      La part glucides 62,5 % (préférence « aucune ») est vérifiée sur le
//      classeur ; 75 % (préférence glucides) et 50 % (préférence lipides)
//      sont symétriques autour de cette valeur — à ajuster ici si la
//      feuille source diffère.

export type Sexe = "homme" | "femme";
export type Objectif = "perte" | "prise";
export type PreferenceAlimentaire = "glucides" | "aucune" | "lipides";

export interface DietInput {
  sexe: Sexe;
  tailleCm: number;
  poidsKg: number;
  age: number;
  /** Coefficient d'activité (voir ACTIVITY_LEVELS). */
  coefficient: number;
  objectif: Objectif;
  /** Déficit (perte) ou surplus (prise) supplémentaire, ex. 0.1 pour 10 %. */
  ajustement: number;
  preference: PreferenceAlimentaire;
}

export interface SemainePlan {
  /** 1-indexé (Semaine 1, Semaine 2, …). */
  numero: number;
  kcal: number;
  proteinesG: number;
  glucidesG: number;
  lipidesG: number;
}

export interface DietPlan {
  /** Masse maigre (kg), non arrondie. */
  lbm: number;
  /** Métabolisme de base (kcal/j), arrondi. */
  bmr: number;
  /** Dépense énergétique totale (kcal/j), arrondie. */
  tdee: number;
  semaines: SemainePlan[];
  /** true si les kcal restantes ne couvrent plus les protéines (profil extrême). */
  macrosEcretees: boolean;
}

export const ACTIVITY_LEVELS = [
  { coefficient: 1.2, label: "Mode de vie sédentaire" },
  { coefficient: 1.3, label: "1 à 3 h d'activités modérées par semaine" },
  { coefficient: 1.35, label: "4 à 6 h d'activités modérées par semaine" },
  { coefficient: 1.4, label: "7 à 9 h d'activités modérées par semaine" },
  { coefficient: 1.45, label: "Plus de 9 h d'activités modérées par semaine" },
] as const;

/** Options de la section « déficit/surplus calorique supplémentaire » (0 = aucun). */
export const AJUSTEMENTS = [0, 0.05, 0.075, 0.1, 0.125, 0.15, 0.175, 0.2] as const;

export const PERTE_SEMAINES = 8;
export const PRISE_SEMAINES = 9;
const PERTE_TAUX_HEBDO = 0.99; // −1 % de kcal chaque semaine
const PRISE_TAUX_HEBDO = 1.02; // +2 % de kcal chaque semaine
const PROTEINES_G_PAR_KG = 2;
const KCAL_PAR_G = { proteines: 4, glucides: 4, lipides: 9 } as const;

/** Part des kcal restantes (hors protéines) allouée aux glucides. */
const PART_GLUCIDES: Record<PreferenceAlimentaire, number> = {
  glucides: 0.75,
  aucune: 0.625,
  lipides: 0.5,
};

/** Masse maigre (kg) selon la formule de Boer. */
export function leanBodyMass(sexe: Sexe, tailleCm: number, poidsKg: number): number {
  return sexe === "homme"
    ? 0.407 * poidsKg + 0.267 * tailleCm - 19.2
    : 0.252 * poidsKg + 0.473 * tailleCm - 48.3;
}

/** Métabolisme de base (kcal/j) selon Katch-McArdle, à partir de la masse maigre. */
export function basalMetabolicRate(lbm: number): number {
  return 370 + 21.6 * lbm;
}

/** Bornes de saisie du formulaire (garde-fous UI, pas dans le classeur). */
export const LIMITES = {
  tailleCm: { min: 120, max: 230 },
  poidsKg: { min: 35, max: 250 },
  age: { min: 15, max: 100 },
} as const;

export function inputValide(i: Pick<DietInput, "tailleCm" | "poidsKg" | "age">): boolean {
  return (
    Number.isFinite(i.tailleCm) &&
    Number.isFinite(i.poidsKg) &&
    Number.isFinite(i.age) &&
    i.tailleCm >= LIMITES.tailleCm.min &&
    i.tailleCm <= LIMITES.tailleCm.max &&
    i.poidsKg >= LIMITES.poidsKg.min &&
    i.poidsKg <= LIMITES.poidsKg.max &&
    i.age >= LIMITES.age.min &&
    i.age <= LIMITES.age.max
  );
}

/** Construit le plan complet (BMR, TDEE, semaines kcal + macros). */
export function buildDietPlan(input: DietInput): DietPlan {
  const lbm = leanBodyMass(input.sexe, input.tailleCm, input.poidsKg);
  const bmrExact = basalMetabolicRate(lbm);
  const tdeeExact = bmrExact * input.coefficient;

  const nbSemaines = input.objectif === "perte" ? PERTE_SEMAINES : PRISE_SEMAINES;
  const taux = input.objectif === "perte" ? PERTE_TAUX_HEBDO : PRISE_TAUX_HEBDO;
  const depart =
    input.objectif === "perte"
      ? tdeeExact * (1 - input.ajustement)
      : tdeeExact * (1 + input.ajustement);

  const proteinesG = PROTEINES_G_PAR_KG * input.poidsKg;
  const partGlucides = PART_GLUCIDES[input.preference];

  let macrosEcretees = false;
  const semaines: SemainePlan[] = [];
  let kcalExact = depart;
  for (let n = 1; n <= nbSemaines; n++) {
    const reste = kcalExact - proteinesG * KCAL_PAR_G.proteines;
    if (reste < 0) macrosEcretees = true;
    const resteUtile = Math.max(0, reste);
    semaines.push({
      numero: n,
      kcal: Math.round(kcalExact),
      proteinesG: Math.round(proteinesG),
      glucidesG: Math.round((resteUtile * partGlucides) / KCAL_PAR_G.glucides),
      lipidesG: Math.round((resteUtile * (1 - partGlucides)) / KCAL_PAR_G.lipides),
    });
    kcalExact *= taux;
  }

  return {
    lbm,
    bmr: Math.round(bmrExact),
    tdee: Math.round(tdeeExact),
    semaines,
    macrosEcretees,
  };
}
