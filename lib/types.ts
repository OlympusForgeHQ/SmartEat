import type { NutritionTarget } from "./nutrition-target";

// Modèle de domaine — reflète le schéma du cahier des charges (§2 Logic Engine).
// Les types restent identiques que les données viennent du seed ou de Postgres.

export type Country = "FR" | "BE";

export type Appliance = "four" | "airfryer" | "micro" | "poele";

export type Capability =
  | "roast"
  | "bake"
  | "gratin"
  | "fry"
  | "sear"
  | "simmer"
  | "heat"
  | "reheat"
  | "steam";

// "Ambiances" du repas (inspiré Romi). On ENRICHIT le modèle existant : les 4
// types historiques restent, on ajoute famille / gourmand / monde pour l'onboarding.
export type MealType =
  | "rapide"
  | "sain"
  | "leger"
  | "proteine"
  | "famille"
  | "gourmand"
  | "monde";

// Moment de la journée auquel un repas a du sens. L'utilisateur choisit les
// moments à planifier (petit-déj / déjeuner / dîner) et le moteur ne propose
// que des recettes adaptées au moment, en équilibrant la semaine entre eux.
export type MealSlot = "petit_dej" | "dejeuner" | "diner";

export type DietTag =
  | "halal"
  | "vege"
  | "vegan"
  | "pescetarien"
  | "sans_gluten"
  | "sans_lactose";

export type Unit = "g" | "ml" | "piece";

export type Aisle =
  | "fruits_legumes"
  | "boucherie"
  | "cremerie"
  | "epicerie"
  | "surgele"
  | "boulangerie";

export interface Ingredient {
  id: string;
  name: string;
  aisle: Aisle;
  baseUnit: Unit;
  // On achète le PRODUIT ENTIER (conditionnement), pas une fraction de portion.
  packSize: number; // contenance d'un conditionnement, en baseUnit
  packLabel: string; // libellé du conditionnement, ex "1 kg", "boîte 400 g", "x6"
  packPrice: number; // prix moyen du conditionnement (€, vérifié/estimé sur le marché FR/BE)
}

export interface RecipeIngredient {
  ingredientId: string;
  qtyPerServing: number; // exprimé dans l'unité de base de l'ingrédient
  unit: Unit;
}

// Valeurs nutritionnelles ESTIMÉES, par portion (proxy simple, §5 roadmap).
// Affichées avec la mention "valeurs estimées" dans l'UI.
export interface Nutrition {
  kcal: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
}

export interface Recipe {
  id: string;
  title: string;
  emoji: string;
  mealTypes: MealType[];
  slots: MealSlot[]; // moments de la journée adaptés (petit-déj / déjeuner / dîner)
  dietTags: DietTag[];
  reqCapabilities: Capability[]; // moteur ensembliste : <= capacités utilisateur
  prepMinutes: number;
  defaultServings: number;
  // Le prix N'EST PLUS stocké : il est calculé depuis les ingrédients au prix du
  // magasin choisi (voir lib/pricing.ts). Garantit "prix = coût réel du panier".
  ingredients: RecipeIngredient[];
  steps: string[]; // étapes de préparation (recette consultable)
  nutrition: Nutrition; // valeurs ESTIMÉES par portion
  imageUrl?: string; // visuel optionnel — fallback dégradé+emoji si absent/échec
}

export type StoreKind = "hyper" | "super" | "proxi" | "discount" | "bio" | "surgele";

export interface Store {
  id: string;
  country: Country;
  name: string;
  domain: string; // pour le logo (service Clearbit) — voir BrandLogo
  color: string; // couleur de marque (repli monogramme si logo absent)
  kind: StoreKind;
  priceFactor: number; // profil de prix de l'enseigne (discounter < hyper < proxi < bio)
}

// Préférences durables capturées une seule fois à l'onboarding (§1).
// On y persiste désormais aussi le budget et l'ambiance par défaut (Romi) afin
// de pré-remplir la génération sans re-poser la question.
export interface UserPrefs {
  country: Country;
  storeId: string;
  dietTags: DietTag[];
  equipment: Appliance[];
  householdSize: number;
  mealsPerWeek: number;
  budget: number; // budget hebdo par défaut (€)
  ambiance: MealType[]; // ambiances préférées (envies par défaut)
  mealSlots: MealSlot[]; // moments à planifier (petit-déj / déjeuner / dîner)
  excludedIngredients?: string[]; // allergènes / aliments à éviter (ids d'ingrédients)
}

// Arbitrages ponctuels demandés à chaque génération (§1).
export interface GenerationRequest {
  budget: number; // € total pour la semaine
  mealTypes: MealType[]; // envies de la semaine (vide = peu importe)
  seed?: number; // graine de variété pour "régénérer la semaine"
  // Cible calories/macros par jour issue du calculateur diète (onglet Diète).
  // Présente -> le plan vise ces calories et ajuste les portions.
  nutrition?: NutritionTarget;
}
