"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Wallet, Wallet2, Sparkles, ShoppingCart } from "lucide-react";
import type { MealType } from "@/lib/types";
import { MEAL_TYPE_LABELS } from "@/lib/labels";
import { buttonClasses } from "@/components/ui/button";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { RecipeImage } from "@/components/recipe-image";
import { PrefsSummary } from "@/components/prefs-summary";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import type { PrefsSummary as Summary } from "@/lib/summary";
import { formatEuro } from "@/lib/utils";

export interface ShowcaseRecipe {
  id: string;
  title: string;
  emoji: string;
  imageUrl?: string;
  prepMinutes: number;
  mealType?: MealType;
  costPerServing: number;
}

const STEPS = [
  {
    icon: <Wallet2 size={22} />,
    title: "Ton budget",
    text: "Dis-nous ton budget de la semaine et ton enseigne.",
  },
  {
    icon: <Sparkles size={22} />,
    title: "On prépare",
    text: "On compose une semaine de repas adaptés à ton budget.",
  },
  {
    icon: <ShoppingCart size={22} />,
    title: "Ta liste",
    text: "Ta liste de courses est prête, groupée par rayon.",
  },
];

export function Landing({
  hasPrefs,
  showcase,
  summary,
  recipeCount,
  storeCount,
}: {
  hasPrefs: boolean;
  showcase: ShowcaseRecipe[];
  summary?: Summary | null;
  recipeCount: number;
  storeCount: number;
}) {
  // Rangée de preuves — stat-tiles sobres (valeur en display serif, libellé muet).
  const stats = [
    { value: String(recipeCount), label: "Recettes maison" },
    { value: String(storeCount), label: "Enseignes, prix adaptés" },
    { value: "3", label: "Clics pour ta liste" },
  ];

  return (
    <main className="mx-auto w-full max-w-md px-6 pb-44 lg:max-w-5xl lg:px-8 lg:pb-24">
      {/* ---------- HERO ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="pt-12"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <span className="text-2xl" aria-hidden>
              🥗
            </span>
            SmartEat
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-on-surface-muted hover:text-on-surface"
            >
              Se connecter
            </Link>
          </div>
        </div>

        <h1 className="mt-10 font-display text-[2.5rem] font-semibold leading-[1.08] tracking-tight">
          Qu&apos;est-ce qu&apos;on mange <em className="text-accent">ce soir</em> ?
        </h1>
        <p className="mt-3 text-xl font-medium text-primary">Plus jamais cette question.</p>
        <p className="mt-4 max-w-2xl text-on-surface-muted">
          SmartEat compose ta semaine de repas selon ton budget, ton équipement et tes envies, puis
          génère ta liste de courses.
        </p>

        {/* mockup : carte coût animée */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 rounded-[var(--radius-card)] border border-outline bg-surface p-5 shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-muted">
              Coût estimé
            </span>
            <Badge tone="primary">🛒 Ma semaine</Badge>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="tnum font-display text-3xl font-semibold tracking-tight text-primary">
              32,40 €
            </span>
            <span className="text-sm text-on-surface-muted">/ 35 €</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-variant">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: "92%" }}
              transition={{ delay: 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </motion.div>
      </motion.section>

      {/* Note honnête : appli perso, gratuite, sans pub */}
      <Reveal className="mt-6 text-center text-sm text-on-surface-muted">
        Une petite appli faite maison — <span className="font-medium text-on-surface">gratuite</span>{" "}
        et sans pub.
      </Reveal>

      {/* ---------- PREUVES ---------- */}
      <Reveal className="mt-8">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-[var(--radius-card)] border border-outline bg-surface px-2 py-4 text-center"
            >
              <p className="font-display text-2xl font-semibold tracking-tight text-primary">
                {s.value}
              </p>
              <p className="mt-1 text-[11px] leading-tight text-on-surface-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Récap pour un utilisateur qui revient : ses choix + accès au menu */}
      {summary && (
        <Reveal className="mt-8">
          <div className="rounded-[var(--radius-card)] border border-primary/30 bg-primary/5 p-4">
            <p className="mb-3 font-semibold">👋 Content de te revoir ! Voici tes choix.</p>
            <PrefsSummary summary={summary} />
            <div className="mt-4 grid gap-2">
              <Link href="/plan" className={`${buttonClasses("primary", "md")} w-full`}>
                Voir mon menu
              </Link>
              <Link href="/onboarding" className={`${buttonClasses("ghost", "md")} w-full`}>
                Modifier mes préférences
              </Link>
            </div>
          </div>
        </Reveal>
      )}

      {/* ---------- COMMENT ÇA MARCHE ---------- */}
      <section className="mt-12">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Comment ça marche ?
          </h2>
        </Reveal>
        <div className="mt-5 space-y-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <div className="flex items-start gap-4 rounded-[var(--radius-card)] border border-outline bg-surface p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  {s.icon}
                </span>
                <div>
                  <p className="font-semibold">
                    <span className="text-primary">{i + 1}.</span> {s.title}
                  </p>
                  <p className="text-sm text-on-surface-muted">{s.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- VITRINE RECETTES ---------- */}
      <section className="mt-12">
        <Reveal className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Des idées qui te ressemblent
          </h2>
          <Link href="/recettes" className="shrink-0 text-sm font-medium text-primary hover:underline">
            Tout voir →
          </Link>
        </Reveal>
        <Stagger className="mt-5 grid grid-cols-2 gap-3">
          {showcase.map((r) => (
            <StaggerItem key={r.id}>
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-outline bg-surface">
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
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} /> {r.prepMinutes} min
                    </span>
                    <span className="tnum inline-flex items-center gap-1">
                      <Wallet size={12} /> {formatEuro(r.costPerServing)}/pers
                    </span>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ---------- CTA FLOTTANT (au-dessus de la bottom nav, voir REFONTE §5) ---------- */}
      <div className="fixed inset-x-0 bottom-[72px] z-30">
        <div className="mx-auto max-w-md px-5 lg:mx-0 lg:ml-auto lg:mr-8 lg:max-w-xs lg:px-0">
          {hasPrefs ? (
            <Link
              href="/plan"
              className={`${buttonClasses("primary", "lg")} w-full shadow-[var(--shadow-lg)]`}
            >
              Reprendre mes repas
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className={`${buttonClasses("primary", "lg")} w-full shadow-[var(--shadow-lg)]`}
            >
              Commencer gratuitement
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
