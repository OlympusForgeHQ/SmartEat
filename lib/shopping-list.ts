import type { Aisle, Ingredient, Recipe, Store } from "./types";
import { AISLE_LABELS } from "./labels";
import { ingredientUnitPrice } from "./pricing";

// Génération de la liste de courses — §2, version "produit entier".
// On agrège les besoins de la semaine, puis on achète des CONDITIONNEMENTS
// ENTIERS : nb de paquets = arrondi supérieur (besoin total / contenance).
// -> un paquet qui suffit à plusieurs repas n'est acheté qu'une fois (anti-doublon).

export interface ShoppingLine {
  ingredient: Ingredient;
  neededQty: number; // quantité réellement nécessaire (unité de base)
  packs: number; // nombre de conditionnements à acheter
  cost: number; // packs × prix paquet × profil magasin
}

export interface ShoppingSection {
  aisle: Aisle;
  label: string;
  lines: ShoppingLine[];
  subtotal: number;
}

export interface ShoppingList {
  sections: ShoppingSection[];
  total: number;
  itemCount: number;
}

// Un repas du panier. Une recette nue vaut « une portion » ; avec une cible
// calorique, le plan sert des portions ajustées (voir lib/nutrition-target.ts)
// et les quantités à acheter suivent le même facteur.
export interface MealPortion {
  recipe: Recipe;
  factor: number;
}

export type BasketItem = Recipe | MealPortion;

function asPortion(item: BasketItem): MealPortion {
  return "recipe" in item ? item : { recipe: item, factor: 1 };
}

export function buildShoppingList(
  basket: readonly BasketItem[],
  ingredientsById: Map<string, Ingredient>,
  householdSize: number,
  store: Store,
  priceBook?: Map<string, number>,
): ShoppingList {
  // 1+2. Agrégation/dédoublonnage des BESOINS par ingrédient
  // (× taille du foyer × facteur de portion du repas).
  const needed = new Map<string, number>();
  for (const item of basket) {
    const { recipe, factor } = asPortion(item);
    for (const ri of recipe.ingredients) {
      needed.set(
        ri.ingredientId,
        (needed.get(ri.ingredientId) ?? 0) + ri.qtyPerServing * householdSize * factor,
      );
    }
  }

  // 3. Conversion en produits entiers (anti-doublon) + coût au profil du magasin.
  const byAisle = new Map<Aisle, ShoppingLine[]>();
  let total = 0;
  let itemCount = 0;

  for (const [ingredientId, neededQty] of needed) {
    const ingredient = ingredientsById.get(ingredientId);
    if (!ingredient || neededQty <= 0) continue;
    const packs = Math.ceil(neededQty / ingredient.packSize);
    // Coût = nb de paquets × prix d'un paquet (prix réel Open Prices si dispo, sinon catalogue).
    const cost = packs * ingredientUnitPrice(ingredient, store, priceBook) * ingredient.packSize;
    total += cost;
    itemCount += 1;
    const line: ShoppingLine = { ingredient, neededQty, packs, cost };
    const bucket = byAisle.get(ingredient.aisle) ?? [];
    bucket.push(line);
    byAisle.set(ingredient.aisle, bucket);
  }

  // 4. Regroupement par rayon (parcours magasin logique).
  const sections: ShoppingSection[] = [...byAisle.entries()]
    .map(([aisle, lines]) => ({
      aisle,
      label: AISLE_LABELS[aisle].label,
      lines: lines.sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name)),
      subtotal: lines.reduce((sum, l) => sum + l.cost, 0),
    }))
    .sort((a, b) => AISLE_LABELS[a.aisle].order - AISLE_LABELS[b.aisle].order);

  return { sections, total, itemCount };
}
