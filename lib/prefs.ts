import { cookies } from "next/headers";
import { z } from "zod";
import type { GenerationRequest, MealType, UserPrefs } from "./types";
import { getSupabaseServer } from "./supabase/server";
import { parseTarget } from "./nutrition-target";

// Préférences durables persistées en cookie (MVP, §4 : alternative simple à
// Supabase Auth + table users, qui reste le chemin de production).
const COOKIE = "smarteat_prefs";
const ONE_YEAR = 60 * 60 * 24 * 365;

const MEAL_TYPE_ENUM = [
  "rapide",
  "sain",
  "leger",
  "proteine",
  "famille",
  "gourmand",
  "monde",
] as const;

const prefsSchema = z.object({
  country: z.enum(["FR", "BE"]),
  storeId: z.string().min(1),
  dietTags: z.array(
    z.enum(["halal", "vege", "vegan", "pescetarien", "sans_gluten", "sans_lactose"]),
  ),
  equipment: z.array(z.enum(["four", "airfryer", "micro", "poele"])).min(1),
  householdSize: z.number().int().min(1).max(12),
  mealsPerWeek: z.number().int().min(1).max(21),
  // Rétrocompat : les cookies plus anciens n'avaient ni budget ni ambiance.
  budget: z.number().min(15).max(300).default(35),
  ambiance: z.array(z.enum(MEAL_TYPE_ENUM)).default([]),
  // Moments à planifier (petit-déj / déjeuner / dîner). Défaut : midi + soir.
  mealSlots: z
    .array(z.enum(["petit_dej", "dejeuner", "collation", "diner"]))
    .default(["dejeuner", "diner"]),
  // Allergènes / aliments à éviter (ids d'ingrédients) — exclus du moteur.
  excludedIngredients: z.array(z.string()).default([]),
});

// Source des préférences : si l'utilisateur est connecté -> profil Supabase
// (multi-appareils) ; sinon -> cookie (mode invité). Migre les prefs invité
// vers le profil au premier accès connecté.
export async function getPrefs(): Promise<UserPrefs | null> {
  const supabase = await getSupabaseServer();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      const fromDb = data?.store_id ? rowToPrefs(data as ProfileRow) : null;
      if (fromDb) {
        // Colonnes pas encore migrées (ex. meal_slots absent de la table) : la
        // valeur revient nulle -> on récupère le choix depuis le cookie miroir,
        // pour que la fonctionnalité marche même avant d'avoir lancé le SQL.
        if (data && (data as ProfileRow).meal_slots == null) {
          const guest = await getPrefsCookie();
          if (guest?.mealSlots?.length) fromDb.mealSlots = guest.mealSlots;
        }
        return fromDb;
      }
      const guest = await getPrefsCookie();
      if (guest) {
        await upsertProfile(supabase, user.id, guest);
        return guest;
      }
      return null;
    }
  }
  return getPrefsCookie();
}

// À appeler depuis une Server Action / Route Handler uniquement.
export async function savePrefs(prefs: UserPrefs): Promise<void> {
  const validated = prefsSchema.parse(prefs);
  const supabase = await getSupabaseServer();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await upsertProfile(supabase, user.id, validated);
      // On garde TOUJOURS un miroir cookie : il conserve les champs que la table
      // n'a pas encore (ex. meal_slots avant migration) et sert de repli réseau.
      // L'onboarding ne doit jamais casser.
      await savePrefsCookie(validated);
      return;
    }
  }
  await savePrefsCookie(validated);
}

// ---- Persistance cookie (mode invité) ----
async function getPrefsCookie(): Promise<UserPrefs | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = prefsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function savePrefsCookie(prefs: UserPrefs): Promise<void> {
  (await cookies()).set(COOKIE, JSON.stringify(prefs), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

// ---- Mapping profil Supabase <-> UserPrefs ----
interface ProfileRow {
  country: string | null;
  store_id: string | null;
  diet_tags: string[] | null;
  equipment: string[] | null;
  household_size: number | null;
  meals_per_week: number | null;
  budget: number | string | null;
  ambiance: string[] | null;
  meal_slots: string[] | null;
  excluded_ingredients: string[] | null;
}

function rowToPrefs(row: ProfileRow): UserPrefs | null {
  const parsed = prefsSchema.safeParse({
    country: row.country,
    storeId: row.store_id,
    dietTags: row.diet_tags ?? [],
    equipment: row.equipment ?? [],
    householdSize: row.household_size ?? 2,
    mealsPerWeek: row.meals_per_week ?? 5,
    budget: Number(row.budget ?? 35),
    ambiance: row.ambiance ?? [],
    // Colonne ajoutée plus tard : si absente -> défaut (midi + soir) via le schéma.
    mealSlots: row.meal_slots ?? undefined,
    excludedIngredients: row.excluded_ingredients ?? [],
  });
  return parsed.success ? parsed.data : null;
}

type SupabaseServer = NonNullable<Awaited<ReturnType<typeof getSupabaseServer>>>;

// Renvoie true si l'écriture a réussi. Toute erreur (colonne manquante, réseau)
// est avalée -> l'appelant peut alors retomber sur le cookie.
async function upsertProfile(
  supabase: SupabaseServer,
  id: string,
  p: UserPrefs,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("profiles").upsert({
      id,
      country: p.country,
      store_id: p.storeId,
      diet_tags: p.dietTags,
      equipment: p.equipment,
      household_size: p.householdSize,
      meals_per_week: p.mealsPerWeek,
      budget: p.budget,
      ambiance: p.ambiance,
      meal_slots: p.mealSlots,
      excluded_ingredients: p.excludedIngredients ?? [],
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

// ---- Arbitrages ponctuels lus depuis l'URL (budget + types de la semaine) ----
const MEAL_TYPES: MealType[] = [
  "rapide",
  "sain",
  "leger",
  "proteine",
  "famille",
  "gourmand",
  "monde",
];

export const DEFAULT_BUDGET = 35;

export function parseRequest(
  searchParams: Record<string, string | string[] | undefined>,
  prefs: UserPrefs,
): GenerationRequest {
  // Budget : URL > préférence par défaut > constante.
  const rawBudget = Number(first(searchParams.budget));
  const budget =
    Number.isFinite(rawBudget) && rawBudget > 0 ? rawBudget : prefs.budget || DEFAULT_BUDGET;

  // Types : URL > ambiance par défaut de l'onboarding (sinon "peu importe").
  const rawTypes = first(searchParams.types);
  const mealTypes = rawTypes
    ? rawTypes.split(",").filter((t): t is MealType => MEAL_TYPES.includes(t as MealType))
    : (prefs.ambiance ?? []);

  // Graine de variété ("régénérer la semaine") — change la sélection sous budget.
  const rawSeed = Number(first(searchParams.seed));
  const seed = Number.isFinite(rawSeed) && rawSeed > 0 ? rawSeed : undefined;

  // Cible calories/macros venue du calculateur diète (onglet Diète). Absente,
  // le plan garde son comportement historique (budget + envies).
  const nutrition = parseTarget({
    kcal: first(searchParams.kcal),
    prot: first(searchParams.prot),
    gluc: first(searchParams.gluc),
    lip: first(searchParams.lip),
  });

  return { budget, mealTypes, seed, nutrition };
}

export function parseMealIds(
  searchParams: Record<string, string | string[] | undefined>,
): string[] {
  const raw = first(searchParams.meals);
  if (!raw) return [];
  return raw.split(",").filter(Boolean);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
