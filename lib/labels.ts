import type {
  Appliance,
  Aisle,
  Capability,
  Country,
  DietTag,
  MealSlot,
  MealType,
  StoreKind,
} from "./types";

// Libellés FR pour l'UI (séparés du domaine pour rester localisables).

export const APPLIANCE_LABELS: Record<Appliance, { label: string; emoji: string }> = {
  four: { label: "Four", emoji: "🔥" },
  airfryer: { label: "Air Fryer", emoji: "🌀" },
  micro: { label: "Micro-ondes", emoji: "📦" },
  poele: { label: "Poêle", emoji: "🍳" },
};

export const DIET_LABELS: Record<DietTag, { label: string; emoji: string }> = {
  halal: { label: "Halal", emoji: "🥩" },
  vege: { label: "Végétarien", emoji: "🥗" },
  vegan: { label: "Vegan", emoji: "🌱" },
  pescetarien: { label: "Pescétarien", emoji: "🐟" },
  sans_gluten: { label: "Sans gluten", emoji: "🌾" },
  sans_lactose: { label: "Sans lactose", emoji: "🥛" },
};

export const MEAL_TYPE_LABELS: Record<MealType, { label: string; emoji: string }> = {
  rapide: { label: "Rapide", emoji: "⚡" },
  sain: { label: "Sain", emoji: "🥦" },
  leger: { label: "Léger", emoji: "🪶" },
  proteine: { label: "Protéiné", emoji: "💪" },
  famille: { label: "En famille", emoji: "👨‍👩‍👧" },
  gourmand: { label: "Gourmand", emoji: "😋" },
  monde: { label: "Saveurs du monde", emoji: "🌍" },
};

// Protéines minimales par portion exigées quand l'ambiance "Riche en protéines"
// est demandée (le moteur ne retient alors que des repas >= ce seuil).
export const PROTEIN_MIN = 35; // g / portion (repas principal)

// Une collation pèse ~12 % de la journée : lui appliquer le seuil d'un repas
// principal la rendrait toujours inéligible, et l'ambiance « Riche en
// protéines » viderait le moment collation (donc tout le plan).
export const PROTEIN_MIN_COLLATION = 12; // g / portion

// Moments de la journée. `short` sert l'onglet vertical de la carte jour ;
// `color` pointe vers les variables CSS du design system (--slot-*) pour
// respecter automatiquement le thème (voir app/globals.css).
export const MEAL_SLOT_LABELS: Record<
  MealSlot,
  { label: string; short: string; emoji: string; color: string }
> = {
  petit_dej: { label: "Petit-déjeuner", short: "P-déj", emoji: "🥐", color: "var(--slot-petit-dej)" },
  dejeuner: { label: "Déjeuner", short: "Déj", emoji: "🍽️", color: "var(--slot-dejeuner)" },
  collation: { label: "Collation", short: "Collation", emoji: "🍎", color: "var(--slot-collation)" },
  diner: { label: "Dîner", short: "Dîner", emoji: "🌙", color: "var(--slot-diner)" },
};

// Ordre d'affichage des moments dans le plan (matin -> soir).
export const MEAL_SLOT_ORDER: MealSlot[] = ["petit_dej", "dejeuner", "collation", "diner"];

// Ambiances de l'onboarding (cartes PASTEL façon Romi). On mappe vers les
// MealType du moteur. `tint` = classes de fond/accent pastel (jusqu'à 3 choix).
export interface AmbianceConfig {
  type: MealType;
  label: string;
  emoji: string;
  hint?: string; // précision affichée sous le libellé
  tint: string; // fond pastel au repos
  tintActive: string; // fond + bordure quand sélectionné
}

export const AMBIANCES: AmbianceConfig[] = [
  { type: "rapide", label: "Rapide & facile", emoji: "⚡", tint: "bg-amber-50 border-amber-100", tintActive: "bg-amber-100 border-amber-300 ring-amber-300" },
  { type: "proteine", label: "Riche en protéines", emoji: "💪", hint: `≥ ${PROTEIN_MIN} g / repas`, tint: "bg-rose-50 border-rose-100", tintActive: "bg-rose-100 border-rose-300 ring-rose-300" },
  { type: "famille", label: "En famille", emoji: "👨‍👩‍👧", tint: "bg-fuchsia-50 border-fuchsia-100", tintActive: "bg-fuchsia-100 border-fuchsia-300 ring-fuchsia-300" },
  { type: "sain", label: "Healthy", emoji: "🥗", tint: "bg-emerald-50 border-emerald-100", tintActive: "bg-emerald-100 border-emerald-300 ring-emerald-300" },
  { type: "gourmand", label: "Gourmand", emoji: "😋", tint: "bg-orange-50 border-orange-100", tintActive: "bg-orange-100 border-orange-300 ring-orange-300" },
  { type: "monde", label: "Saveurs du monde", emoji: "🌍", tint: "bg-teal-50 border-teal-100", tintActive: "bg-teal-100 border-teal-300 ring-teal-300" },
];

// Allergènes / aliments à éviter proposés à l'onboarding. Chaque groupe mappe
// vers des ids d'ingrédients du catalogue ; sélectionner exclut ces ingrédients.
export interface ExclusionConfig {
  key: string;
  label: string;
  emoji: string;
  ingredientIds: string[];
}

export const EXCLUSIONS: ExclusionConfig[] = [
  { key: "arachide", label: "Arachide", emoji: "🥜", ingredientIds: ["peanut_butter"] },
  { key: "poisson", label: "Poisson", emoji: "🐟", ingredientIds: ["salmon", "cod", "tuna_canned"] },
  { key: "crustaces", label: "Crustacés", emoji: "🦐", ingredientIds: ["shrimp"] },
  { key: "oeufs", label: "Œufs", emoji: "🥚", ingredientIds: ["eggs"] },
  { key: "champignons", label: "Champignons", emoji: "🍄", ingredientIds: ["mushroom"] },
  { key: "soja", label: "Soja", emoji: "🫛", ingredientIds: ["tofu", "soy_sauce"] },
  { key: "boeuf", label: "Bœuf", emoji: "🥩", ingredientIds: ["beef", "beef_steak"] },
];

export const AISLE_LABELS: Record<Aisle, { label: string; order: number }> = {
  fruits_legumes: { label: "Fruits & Légumes", order: 1 },
  boucherie: { label: "Boucherie / Poissonnerie", order: 2 },
  cremerie: { label: "Crémerie", order: 3 },
  boulangerie: { label: "Boulangerie", order: 4 },
  epicerie: { label: "Épicerie", order: 5 },
  surgele: { label: "Surgelé", order: 6 },
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  roast: "Rôtir",
  bake: "Cuire au four",
  gratin: "Gratiner",
  fry: "Frire / poêler",
  sear: "Saisir",
  simmer: "Mijoter",
  heat: "Chauffer",
  reheat: "Réchauffer",
  steam: "Vapeur",
};

export const COUNTRY_LABELS: Record<Country, { label: string; flag: string }> = {
  FR: { label: "France", flag: "🇫🇷" },
  BE: { label: "Belgique", flag: "🇧🇪" },
};

export const STORE_KIND_LABELS: Record<StoreKind, string> = {
  hyper: "Hypermarché",
  super: "Supermarché",
  proxi: "Magasin de proximité",
  discount: "Hard discount",
  bio: "Magasin bio",
  surgele: "Surgelés",
};

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Libellé du jour pour le plan hebdo (au-delà de 7, on numérote).
export function dayLabel(index: number): string {
  return WEEKDAYS[index] ?? `Jour ${index + 1}`;
}

export function dayShort(index: number): string {
  const full = dayLabel(index);
  return full.length > 4 ? full.slice(0, 3) : full;
}

// Onglet jour coloré à gauche de la carte (plan, façon Romi). Les couleurs
// pointent vers les variables CSS du design system (--day-1..--day-7) pour
// s'adapter automatiquement au thème (voir app/globals.css).
const DAY_COLORS = [
  "var(--day-1)", // lun — vert primaire
  "var(--day-2)", // mar — sky
  "var(--day-3)", // mer — ambre
  "var(--day-4)", // jeu — violet
  "var(--day-5)", // ven — rose
  "var(--day-6)", // sam — teal
  "var(--day-7)", // dim — orange
];

export function dayColor(index: number): string {
  return DAY_COLORS[index % DAY_COLORS.length];
}
