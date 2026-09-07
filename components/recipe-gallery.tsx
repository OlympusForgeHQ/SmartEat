"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Search, Wallet } from "lucide-react";
import type { MealSlot, MealType } from "@/lib/types";
import { MEAL_SLOT_LABELS, MEAL_TYPE_LABELS } from "@/lib/labels";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { RecipeImage } from "@/components/recipe-image";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/favorite-button";
import { useFavorites } from "@/lib/favorites";
import { formatEuro } from "@/lib/utils";

export interface GalleryRecipe {
  id: string;
  title: string;
  emoji: string;
  imageUrl?: string;
  prepMinutes: number;
  mealType?: MealType;
  slots: MealSlot[];
  costPerServing: number;
}

type Filter = MealSlot | "tous" | "favoris";

const FILTERS: { key: Filter; label: string; emoji: string }[] = [
  { key: "tous", label: "Tous", emoji: "🍴" },
  { key: "favoris", label: "Favoris", emoji: "❤️" },
  { key: "petit_dej", label: MEAL_SLOT_LABELS.petit_dej.label, emoji: MEAL_SLOT_LABELS.petit_dej.emoji },
  { key: "dejeuner", label: MEAL_SLOT_LABELS.dejeuner.label, emoji: MEAL_SLOT_LABELS.dejeuner.emoji },
  { key: "diner", label: MEAL_SLOT_LABELS.diner.label, emoji: MEAL_SLOT_LABELS.diner.emoji },
];

// Comparaison insensible aux accents et à la casse ("pate" trouve "Pâtes") :
// NFD sépare les diacritiques (U+0300–U+036F), qu'on supprime ensuite.
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function RecipeGallery({ recipes }: { recipes: GalleryRecipe[] }) {
  const [filter, setFilter] = useState<Filter>("tous");
  const [query, setQuery] = useState("");
  const { isFavorite } = useFavorites();

  const q = normalize(query);
  const filtered = recipes
    .filter((r) =>
      filter === "tous"
        ? true
        : filter === "favoris"
          ? isFavorite(r.id)
          : r.slots.includes(filter),
    )
    .filter((r) => (q ? normalize(r.title).includes(q) : true));

  return (
    <div>
      {/* Recherche par nom de plat */}
      <label className="relative block">
        <Search
          size={17}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une recette…"
          aria-label="Rechercher une recette"
          className="h-12 w-full max-w-xl rounded-full border border-outline bg-surface pl-11 pr-4 text-[15px] text-on-surface placeholder:text-on-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      </label>

      {/* Filtres : favoris + moments de la journée */}
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`min-h-11 shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
              filter === f.key
                ? "border-primary bg-primary text-on-primary"
                : "border-outline bg-surface text-on-surface-muted"
            }`}
          >
            {f.emoji} {f.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-on-surface-muted">
        {filtered.length} recette{filtered.length > 1 ? "s" : ""} avec photo
      </p>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-[var(--radius-card)] border border-dashed border-outline bg-surface p-6 text-center">
          <p className="font-medium">
            {filter === "favoris" && !q ? "Aucun favori pour l'instant. ❤️" : "Aucune recette trouvée."}
          </p>
          <p className="mt-1 text-sm text-on-surface-muted">
            {filter === "favoris" && !q
              ? "Touche le cœur d'une recette pour la retrouver ici."
              : "Essaie un autre mot-clé ou un autre filtre."}
          </p>
        </div>
      ) : (
        <Stagger className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {filtered.map((r) => (
            <StaggerItem key={r.id}>
              {/* Le cœur vit HORS du lien (pas d'interactif imbriqué) */}
              <article className="relative overflow-hidden rounded-[var(--radius-card)] border border-outline bg-surface">
                <Link href={`/recipe/${r.id}`} className="block">
                  <RecipeImage
                    src={r.imageUrl}
                    query={r.title}
                    emoji={r.emoji}
                    seed={r.id}
                    alt={r.title}
                    rounded="rounded-none"
                    className="aspect-[4/3] w-full"
                    emojiClassName="text-5xl"
                  />
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {r.mealType && (
                        <Badge tone="primary">
                          {MEAL_TYPE_LABELS[r.mealType].emoji} {MEAL_TYPE_LABELS[r.mealType].label}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-on-surface-muted">
                      <span className="tnum inline-flex items-center gap-1">
                        <Clock size={12} /> {r.prepMinutes} min
                      </span>
                      <span className="tnum inline-flex items-center gap-1">
                        <Wallet size={12} /> {formatEuro(r.costPerServing)}/pers
                      </span>
                    </div>
                  </div>
                </Link>
                <FavoriteButton
                  recipeId={r.id}
                  title={r.title}
                  className="absolute right-2 top-2 z-10"
                />
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
