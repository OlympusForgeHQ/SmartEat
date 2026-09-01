"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Flame,
  RotateCcw,
  ShoppingCart,
  Target,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { CountUpEuro } from "@/components/ui/count-up";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { PlanDayCard, type PlanCardRecipe } from "@/components/plan-day-card";
import { buttonClasses } from "@/components/ui/button";
import { MEAL_SLOT_ORDER, dayLabel } from "@/lib/labels";
import { formatEuro } from "@/lib/utils";

export interface PlanViewData {
  store: { name: string; domain: string; color: string };
  recipes: (PlanCardRecipe & { mealCost: number; swapHref: string | null })[];
  selectedIds: string[];
  total: number;
  budget: number;
  itemCount: number;
  householdSize: number;
  plannedDays: number;
  withinBudget: boolean;
  regenerateHref: string;
  listHref: string;
  homeHref: string;
  homeLabel: string;
  priceLive: number;
  priceStatus: "catalog" | "mixed" | "unavailable";
  // Cible venue du calculateur diète (onglet Diète). null = semaine libre.
  nutritionTarget: {
    kcalCible: number;
    kcalAtteint: number;
    proteinesCible: number;
    proteinesAtteint: number;
    resetHref: string;
    // Budget qui couvrirait 7 jours à cette cible (null si non calculable).
    budgetSemaine: number | null;
    budgetHref: string | null;
  } | null;
}

const slotRank = (s: PlanCardRecipe["slot"]) => MEAL_SLOT_ORDER.indexOf(s);

export function PlanView({
  children,
  ...data
}: PlanViewData & { children?: React.ReactNode }) {
  const over = data.total > data.budget + 0.001;

  // Regroupement par JOUR de la semaine (Lundi -> Dimanche). Chaque jour affiche
  // ses repas, triés du matin au soir (petit-déj -> déjeuner -> dîner).
  const days = [...new Set(data.recipes.map((r) => r.day))].sort((a, b) => a - b);
  const groups = days.map((day) => ({
    day,
    items: data.recipes
      .filter((r) => r.day === day)
      .sort((a, b) => slotRank(a.slot) - slotRank(b.slot)),
  }));

  // Équilibre de la semaine : moyennes PAR JOUR et PAR PERSONNE, à partir des
  // valeurs nutritionnelles (par portion) des recettes planifiées.
  const dayCount = Math.max(days.length, 1);
  // Portions réellement servies : une cible calorique fait manger ×1,4 d'un plat.
  const avgKcal = Math.round(
    data.recipes.reduce((s, r) => s + r.kcal * r.factor, 0) / dayCount,
  );
  const avgProtein = Math.round(
    data.recipes.reduce((s, r) => s + r.protein * r.factor, 0) / dayCount,
  );
  const balance = [
    { icon: Flame, value: String(avgKcal), caption: "kcal / jour" },
    { icon: Zap, value: `${avgProtein} g`, caption: "protéines / jour" },
    { icon: UtensilsCrossed, value: String(data.recipes.length), caption: "repas planifiés" },
  ];

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-44 pt-6">
      {/* Navigation : retour au compte (connecté) ou à l'accueil (invité) */}
      <Link
        href={data.homeHref}
        className="mb-3 inline-flex items-center gap-1 text-sm text-on-surface-muted hover:text-on-surface"
      >
        <ChevronLeft size={16} /> {data.homeLabel}
      </Link>

      {/* En-tête : titre + badge magasin */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mb-5"
      >
        <h1 className="font-display text-3xl font-semibold tracking-tight">Bon appétit ! 🎉</h1>
        <p className="mt-1 text-on-surface-muted">Ta semaine est prête.</p>
        <div className="mt-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-outline bg-surface px-3 py-1.5 text-sm">
            <BrandLogo
              domain={data.store.domain}
              name={data.store.name}
              color={data.store.color}
              size={22}
            />
            <span className="font-medium">🛒 Prévu pour {data.store.name}</span>
          </span>
        </div>
      </motion.header>

      {data.recipes.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-outline bg-surface p-6 text-center">
          <p className="font-medium">Aucune recette ne rentre dans ce budget.</p>
          <p className="mt-1 text-sm text-on-surface-muted">
            Augmente le budget ou régénère la semaine.
          </p>
          <Link
            href={data.regenerateHref}
            className={`${buttonClasses("secondary", "md")} mt-4 w-full`}
          >
            <RotateCcw size={16} /> Régénérer la semaine
          </Link>
        </div>
      ) : (
        <>
          {/* Cible diète : la raison d'être de cette sélection, donc en tête. */}
          {data.nutritionTarget && (
            <NutritionTargetCard target={data.nutritionTarget} />
          )}

          {/* Carte COÛT ESTIMÉ avec barre animée */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="rounded-[var(--radius-card)] border border-outline bg-surface p-4 shadow-[var(--shadow-md)]"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-muted">
                Coût estimé
              </span>
              <span className="tnum text-sm text-on-surface-muted">
                budget {formatEuro(data.budget)}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <CountUpEuro
                value={data.total}
                className={`tnum font-display text-3xl font-semibold tracking-tight ${over ? "text-accent" : "text-primary"}`}
              />
              <span className="tnum text-sm text-on-surface-muted">/ {formatEuro(data.budget)}</span>
            </div>
            <ProgressBar value={data.total} max={data.budget} over={over} className="mt-3" />
          </motion.section>

          {data.priceStatus !== "catalog" && (
            <p className="mt-2 text-center text-xs text-on-surface-muted">
              {data.priceStatus === "unavailable"
                ? "Prix réels momentanément indisponibles — estimations affichées."
                : `💰 ${data.priceLive} prix réels (Open Prices) · le reste estimé`}
            </p>
          )}

          {/* NOUVEAU : Équilibre de la semaine (moyennes par jour, par personne) */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="mt-3 rounded-[var(--radius-card)] border border-outline bg-surface p-4"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-muted">
              Équilibre de la semaine
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {balance.map((b) => (
                <div key={b.caption} className="rounded-2xl bg-primary/10 px-2 py-3 text-center">
                  <b.icon size={15} className="mx-auto text-primary" aria-hidden />
                  <div className="tnum mt-1 font-display text-xl font-semibold tracking-tight text-on-surface">
                    {b.value}
                  </div>
                  <div className="text-[11px] font-medium text-on-surface-muted">{b.caption}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] text-on-surface-muted">
              Moyennes par personne, valeurs estimées.
            </p>
          </motion.section>

          {/* Carte "N articles · liste de courses" cliquable */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mt-3"
          >
            <Link
              href={data.listHref}
              className="flex items-center gap-3 rounded-[var(--radius-card)] border border-outline bg-surface p-4 transition-colors hover:bg-surface-variant"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <ShoppingCart size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {data.itemCount} articles · liste de courses
                </span>
                <span className="block text-sm text-on-surface-muted">
                  Groupée par rayon, prête à l&apos;emploi
                </span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-on-surface-muted" />
            </Link>
          </motion.div>

          {/* Avertissement : le budget ne couvre pas la semaine complète */}
          {!data.withinBudget && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-3 text-sm">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-accent" />
              <span>
                Le budget couvre <b>{data.plannedDays}</b> jour{data.plannedDays > 1 ? "s" : ""} sur 7.{" "}
                {data.nutritionTarget ? (
                  <>
                    Manger {data.nutritionTarget.kcalCible.toLocaleString("fr-FR")} kcal par jour
                    demande des portions plus grandes, donc plus de courses.
                    {data.nutritionTarget.budgetHref && (
                      <>
                        {" "}
                        <Link
                          href={data.nutritionTarget.budgetHref}
                          className="font-semibold underline underline-offset-2"
                        >
                          Passer le budget à {formatEuro(data.nutritionTarget.budgetSemaine!)}
                        </Link>{" "}
                        pour couvrir les 7 jours.
                      </>
                    )}
                  </>
                ) : (
                  "Augmente le budget pour couvrir plus de jours."
                )}
              </span>
            </div>
          )}

          {/* Repas regroupés par JOUR de la semaine (Lundi -> Dimanche) */}
          <div className="mt-6 space-y-7">
            {groups.map((g) => (
              <section key={g.day}>
                <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                  {dayLabel(g.day)}
                  <span className="text-sm font-normal text-on-surface-muted">
                    · {g.items.length} repas
                  </span>
                </h2>
                <Stagger className="space-y-3">
                  {g.items.map((r) => (
                    <StaggerItem key={r.id}>
                      <PlanDayCard
                        recipe={r}
                        householdSize={data.householdSize}
                        mealCost={r.mealCost}
                        swapHref={r.swapHref}
                      />
                    </StaggerItem>
                  ))}
                </Stagger>
              </section>
            ))}
          </div>

          {/* Régénérer la semaine */}
          <div className="mt-6 text-center">
            <Link
              href={data.regenerateHref}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <RotateCcw size={15} /> Régénérer la semaine
            </Link>
          </div>

          {/* Réglages complémentaires (ex. "Ajuster cette semaine") */}
          {children}
        </>
      )}

      {/* CTA flottant AU-DESSUS de la bottom nav (voir REFONTE.md §5) */}
      {data.recipes.length > 0 && (
        <div className="fixed inset-x-0 bottom-[72px] z-30">
          <div className="mx-auto max-w-md px-5">
            <Link
              href={data.listHref}
              className={`${buttonClasses("primary", "lg")} w-full shadow-[var(--shadow-lg)]`}
            >
              <ShoppingCart size={18} /> Voir la liste de courses
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Bandeau « cible diète » : ce que le calculateur vise, ce que la semaine
// atteint réellement. L'écart est signé et coloré (vert dans la tolérance,
// terracotta au-delà) — l'utilisateur voit d'un coup si le plan tient sa promesse.
function NutritionTargetCard({
  target,
}: {
  target: NonNullable<PlanViewData["nutritionTarget"]>;
}) {
  const ecart = target.kcalAtteint - target.kcalCible;
  const dansLaCible = Math.abs(ecart) <= target.kcalCible * 0.1;
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Cible du calculateur diète"
      className="mb-3 rounded-[var(--radius-card)] border border-primary/25 bg-primary/8 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-muted">
          <Target size={13} className="text-primary" aria-hidden /> Cible diète
        </h2>
        <Link
          href={target.resetHref}
          className="shrink-0 text-xs font-medium text-on-surface-muted underline underline-offset-2 hover:text-on-surface"
        >
          Retirer
        </Link>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="tnum font-display text-3xl font-semibold tracking-tight text-primary">
          {target.kcalAtteint.toLocaleString("fr-FR")}
        </span>
        <span className="tnum text-sm text-on-surface-muted">
          / {target.kcalCible.toLocaleString("fr-FR")} kcal par jour
        </span>
      </div>
      <p className="tnum mt-1.5 text-xs text-on-surface-muted">
        <span className={dansLaCible ? "font-semibold text-primary" : "font-semibold text-accent"}>
          {ecart === 0 ? "pile sur la cible" : `${ecart > 0 ? "+" : "−"}${Math.abs(ecart)} kcal`}
        </span>{" "}
        · protéines {target.proteinesAtteint} / {target.proteinesCible} g · portions ajustées.
      </p>
    </motion.section>
  );
}
