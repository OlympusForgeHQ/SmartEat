"use client";

import Link from "next/link";
import { RefreshCw, Clock, Users, Wallet } from "lucide-react";
import type { MealSlot, MealType } from "@/lib/types";
import { MEAL_SLOT_LABELS, MEAL_TYPE_LABELS } from "@/lib/labels";
import { formatEuro } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { RecipeImage } from "@/components/recipe-image";

export interface PlanCardRecipe {
  id: string;
  title: string;
  emoji: string;
  imageUrl?: string;
  prepMinutes: number;
  mealTypes: MealType[];
  slot: MealSlot;
  day: number; // 0 = Lundi … (regroupement par jour dans le plan)
  kcal: number; // par portion (équilibre de la semaine)
  protein: number; // g par portion
  factor: number; // portion servie (1 = portion catalogue ; >1 si cible calorique)
}

// Carte repas photo-forward (SmartEat 3.0) : grande photo à gauche, pastille
// « moment » posée sur la photo, nom, temps, nb personnes, prix. -> détail.
export function PlanDayCard({
  recipe,
  householdSize,
  mealCost,
  swapHref,
}: {
  recipe: PlanCardRecipe;
  householdSize: number;
  mealCost: number;
  swapHref: string | null;
}) {
  const slot = MEAL_SLOT_LABELS[recipe.slot];
  return (
    <article className="relative overflow-hidden rounded-[var(--radius-card)] border border-outline bg-surface">
      <Link href={`/recipe/${recipe.id}`} className="flex min-w-0 items-stretch">
        <div className="relative shrink-0">
          <RecipeImage
            src={recipe.imageUrl}
            query={recipe.title}
            emoji={recipe.emoji}
            seed={recipe.id}
            alt={recipe.title}
            rounded="rounded-none"
            className="h-28 w-28"
            emojiClassName="text-4xl"
          />
          {/* Pastille moment posée sur la photo */}
          <span
            className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: slot.color }}
          >
            {slot.short}
          </span>
        </div>

        <div className="min-w-0 flex-1 self-center p-3 pr-12">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">{recipe.title}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {recipe.mealTypes.slice(0, 2).map((t) => (
              <Badge key={t} tone="primary">
                {MEAL_TYPE_LABELS[t].emoji} {MEAL_TYPE_LABELS[t].label}
              </Badge>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-on-surface-muted">
            <span className="tnum inline-flex items-center gap-1">
              <Clock size={12} /> {recipe.prepMinutes} min
            </span>
            <span className="tnum inline-flex items-center gap-1">
              <Users size={12} /> {householdSize}
            </span>
            <span className="tnum inline-flex items-center gap-1 font-medium text-on-surface">
              <Wallet size={12} /> {formatEuro(mealCost)}
            </span>
          </div>
          {/* Portion ajustée à la cible calorique : on annonce l'assiette réelle. */}
          {recipe.factor !== 1 && (
            <p className="tnum mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              ×{recipe.factor.toLocaleString("fr-FR")} portion ·{" "}
              {Math.round(recipe.kcal * recipe.factor)} kcal
            </p>
          )}
        </div>
      </Link>

      {swapHref && (
        <Link
          href={swapHref}
          aria-label={`Changer ${recipe.title}`}
          className="absolute right-1.5 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-on-surface-muted transition-colors hover:bg-surface-variant hover:text-on-surface"
        >
          <RefreshCw size={17} />
        </Link>
      )}
    </article>
  );
}
