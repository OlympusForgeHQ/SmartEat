"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { ShoppingSection } from "@/lib/shopping-list";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ShareListButton } from "@/components/share-list-button";
import { setPantryItem } from "@/app/pantry-actions";
import { cn, formatEuro, formatQty } from "@/lib/utils";

// Liste de courses interactive avec PLACARD : cocher « j'ai déjà » retire l'article
// du panier (et du total), sans le racheter. Connecté -> placard persisté dans
// Supabase (multi-appareils) ; invité -> localStorage (reste d'une semaine à l'autre).
const PANTRY_KEY = "smarteat_pantry";

export function ShoppingList({
  sections,
  storeName,
  authed = false,
  initialOwned = [],
}: {
  sections: ShoppingSection[];
  storeName: string;
  authed?: boolean;
  initialOwned?: string[];
}) {
  const [owned, setOwned] = useState<Set<string>>(() => new Set(authed ? initialOwned : []));

  // Invité : on hydrate depuis localStorage après le montage (SSR rend tout "à acheter").
  useEffect(() => {
    if (authed) return; // connecté : la source est Supabase (initialOwned)
    try {
      const raw = localStorage.getItem(PANTRY_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setOwned(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* localStorage indisponible — on ignore */
    }
  }, [authed]);

  function toggle(id: string) {
    setOwned((prev) => {
      const next = new Set(prev);
      const willOwn = !next.has(id);
      if (willOwn) next.add(id);
      else next.delete(id);
      if (authed) {
        void setPantryItem(id, willOwn); // persistance Supabase (optimiste)
      } else {
        try {
          localStorage.setItem(PANTRY_KEY, JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  // Total restant + progression : X articles cochés sur N (le placard peut
  // contenir des ingrédients hors liste, on ne compte que ceux de la liste).
  const { total, itemCount, checkedCount } = useMemo(() => {
    let total = 0;
    let itemCount = 0;
    let checkedCount = 0;
    for (const s of sections) {
      for (const l of s.lines) {
        itemCount += 1;
        if (owned.has(l.ingredient.id)) checkedCount += 1;
        else total += l.cost;
      }
    }
    return { total, itemCount, checkedCount };
  }, [sections, owned]);

  const remaining = itemCount - checkedCount;

  // Texte brut de partage : titre, rayons, articles + quantités, total estimé.
  const shareText = useMemo(() => {
    const lines = [`SmartEat — Liste de courses (${storeName})`, ""];
    for (const s of sections) {
      const kept = s.lines.filter((l) => !owned.has(l.ingredient.id));
      if (!kept.length) continue;
      lines.push(s.label);
      for (const l of kept) {
        lines.push(
          `- ${l.ingredient.name} : ${l.packs} × ${l.ingredient.packLabel}` +
            ` (besoin ${formatQty(l.neededQty, l.ingredient.baseUnit)})`,
        );
      }
      lines.push("");
    }
    lines.push(`Total estimé : ${formatEuro(total)}`);
    return lines.join("\n");
  }, [sections, owned, storeName, total]);

  return (
    <>
      {/* Progression : X/N articles + barre fine, mise à jour au fil des cases */}
      <div className="mb-5 rounded-[var(--radius-card)] border border-outline bg-surface p-4 shadow-[var(--shadow-md)]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="tnum text-sm font-semibold">
            {checkedCount}/{itemCount} articles
            <span className="ml-1.5 font-normal text-on-surface-muted">au placard</span>
          </p>
          <p className="tnum font-display text-xl font-semibold tracking-tight">
            {formatEuro(total)}
          </p>
        </div>
        <ProgressBar value={checkedCount} max={itemCount} className="mt-2.5 h-1.5" />
        <p className="mt-2 text-xs text-on-surface-muted">
          {remaining} à acheter · produits entiers · total estimé
        </p>
      </div>

      <Stagger className="space-y-4 lg:columns-2 lg:gap-5 lg:space-y-0 [&>*]:lg:mb-5 [&>*]:lg:break-inside-avoid">
        {sections.map((section) => {
          const subtotal = section.lines.reduce(
            (sum, l) => (owned.has(l.ingredient.id) ? sum : sum + l.cost),
            0,
          );
          return (
            <StaggerItem key={section.aisle}>
              <section className="overflow-hidden rounded-[var(--radius-card)] border border-outline bg-surface">
                <div className="flex items-baseline justify-between border-b border-outline bg-surface-variant/50 px-4 py-2.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-muted">
                    {section.label}
                  </h2>
                  <span className="tnum text-xs text-on-surface-muted">{formatEuro(subtotal)}</span>
                </div>
                <ul>
                  {section.lines.map((line) => {
                    const isOwned = owned.has(line.ingredient.id);
                    return (
                      <li
                        key={line.ingredient.id}
                        className={cn(
                          "flex items-center gap-2 border-b border-outline py-1.5 pl-2 pr-4 transition-opacity last:border-b-0",
                          isOwned && "opacity-55",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggle(line.ingredient.id)}
                          aria-pressed={isOwned}
                          aria-label={`J'ai déjà ${line.ingredient.name}`}
                          className="grid h-11 w-11 shrink-0 place-items-center"
                        >
                          <span
                            className={cn(
                              "grid h-6 w-6 place-items-center rounded-full border transition-colors",
                              isOwned
                                ? "border-primary bg-primary text-on-primary"
                                : "border-outline hover:border-primary",
                            )}
                          >
                            {isOwned && <Check size={14} strokeWidth={3} />}
                          </span>
                        </button>
                        <div className="min-w-0 flex-1 py-1.5">
                          <span
                            className={cn(
                              "block truncate font-medium",
                              isOwned && "line-through decoration-1",
                            )}
                          >
                            {line.ingredient.name}
                          </span>
                          <span className="block text-xs text-on-surface-muted">
                            {isOwned
                              ? "déjà dans le placard"
                              : `besoin ${formatQty(line.neededQty, line.ingredient.baseUnit)}`}
                          </span>
                        </div>
                        <div className="shrink-0 py-1.5 text-right">
                          <span
                            className={cn(
                              "block text-sm font-medium",
                              isOwned && "text-on-surface-muted line-through decoration-1",
                            )}
                          >
                            {line.packs} × {line.ingredient.packLabel}
                          </span>
                          <span className="tnum block text-xs text-on-surface-muted">
                            {formatEuro(line.cost)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* CTA flottant au-dessus de la barre d'onglets (voir REFONTE.md §5) */}
      <div className="fixed inset-x-0 bottom-[72px] z-30">
        <div className="mx-auto max-w-md px-5 lg:mx-0 lg:ml-auto lg:mr-8 lg:max-w-xs lg:px-0">
          <ShareListButton
            title={`SmartEat — Liste de courses (${storeName})`}
            text={shareText}
            className="w-full shadow-[var(--shadow-lg)]"
          />
        </div>
      </div>
    </>
  );
}
