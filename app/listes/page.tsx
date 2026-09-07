import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { repo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/supabase/server";
import { loadShoppingLists } from "@/app/list-actions";
import { loadPantry } from "@/app/pantry-actions";
import { SavedListsView, type SavedListDisplay } from "@/components/saved-lists-view";

// Mes listes de courses — l'utilisateur peut en garder plusieurs.
export default async function ListesPage() {
  const user = await getCurrentUser();
  const initialLists = user ? await loadShoppingLists() : [];

  // Progression « au placard » (connecté uniquement) : on croise le placard
  // avec les ingrédients uniques de chaque liste (recettes -> ingrédients).
  // Invité : les listes vivent dans localStorage, la progression n'est pas dispo.
  let lists: SavedListDisplay[] = initialLists;
  if (user && initialLists.length > 0) {
    const [pantryIds, recipes] = await Promise.all([
      loadPantry(),
      repo.getRecipesByIds([...new Set(initialLists.flatMap((l) => l.mealIds))]),
    ]);
    const pantry = new Set(pantryIds);
    const recipesById = new Map(recipes.map((r) => [r.id, r]));
    lists = initialLists.map((l) => {
      const ingredientIds = new Set<string>();
      for (const mealId of l.mealIds) {
        for (const ri of recipesById.get(mealId)?.ingredients ?? []) {
          ingredientIds.add(ri.ingredientId);
        }
      }
      if (ingredientIds.size === 0) return l;
      let ownedCount = 0;
      for (const id of ingredientIds) if (pantry.has(id)) ownedCount += 1;
      return { ...l, ownedCount, ingredientCount: ingredientIds.size };
    });
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-28 pt-8 lg:max-w-5xl lg:px-8 lg:pt-12">
      <Link
        href={user ? "/compte" : "/"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-on-surface-muted hover:text-on-surface"
      >
        <ChevronLeft size={16} /> {user ? "Mon compte" : "Accueil"}
      </Link>

      <h1 className="font-display text-3xl font-semibold tracking-tight">Mes listes</h1>
      <p className="mt-1 text-sm text-on-surface-muted">
        {user ? "Synchronisées sur ton compte." : "Gardées sur cet appareil (mode invité)."}
      </p>

      <SavedListsView authed={!!user} initialLists={lists} />
    </main>
  );
}
