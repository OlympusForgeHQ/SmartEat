"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, Minus, Plus } from "lucide-react";
import type { Appliance, Country, DietTag, MealSlot, MealType, Store } from "@/lib/types";
import {
  AMBIANCES,
  APPLIANCE_LABELS,
  COUNTRY_LABELS,
  DIET_LABELS,
  EXCLUSIONS,
  MEAL_SLOT_LABELS,
  MEAL_SLOT_ORDER,
  STORE_KIND_LABELS,
} from "@/lib/labels";
import { completeOnboarding } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { Tappable } from "@/components/ui/motion";
import { BrandLogo } from "@/components/brand-logo";
import { ApplianceIcon } from "@/components/appliance-icon";
import { cn, formatEuro } from "@/lib/utils";

// Onboarding façon Romi — une question par écran, transitions animées.
// Pays -> Magasin -> Budget -> Personnes -> Repas -> Ambiance -> Besoins -> Éviter -> Cuisine.
const COUNTRIES = Object.keys(COUNTRY_LABELS) as Country[];
const DIETS = Object.keys(DIET_LABELS) as DietTag[];
const APPLIANCES = Object.keys(APPLIANCE_LABELS) as Appliance[];
const STEPS = [
  "Pays",
  "Magasin",
  "Budget",
  "Personnes",
  "Repas",
  "Ambiance",
  "Besoins",
  "Éviter",
  "Cuisine",
] as const;
const MAX_AMBIANCE = 3;

export function OnboardingWizard({ stores }: { stores: Store[] }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [pending, startTransition] = useTransition();

  const [country, setCountry] = useState<Country>("FR");
  const [storeId, setStoreId] = useState("");
  const [budget, setBudget] = useState(35);
  const [householdSize, setHouseholdSize] = useState(2);
  const [mealSlots, setMealSlots] = useState<MealSlot[]>(["dejeuner", "diner"]);
  const [ambiance, setAmbiance] = useState<MealType[]>([]);
  const [diets, setDiets] = useState<DietTag[]>([]);
  const [equipment, setEquipment] = useState<Appliance[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [mealsPerWeek] = useState(5);

  const storesForCountry = useMemo(
    () =>
      stores
        .filter((s) => s.country === country)
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [stores, country],
  );

  const canContinue =
    (step === 0 && !!country) ||
    (step === 1 && !!storeId) ||
    step === 2 ||
    step === 3 ||
    (step === 4 && mealSlots.length > 0) ||
    step === 5 ||
    step === 6 ||
    step === 7 ||
    (step === 8 && equipment.length > 0);

  function go(delta: number) {
    setDir(delta);
    setStep((s) => s + delta);
  }

  function next() {
    if (step < STEPS.length - 1) {
      go(1);
      return;
    }
    startTransition(() =>
      completeOnboarding({
        country,
        storeId,
        dietTags: diets,
        equipment,
        householdSize,
        mealsPerWeek,
        budget,
        ambiance,
        mealSlots,
        excludedIngredients: excluded,
      }),
    );
  }

  function toggleSlot(s: MealSlot) {
    setMealSlots((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function toggleAmbiance(t: MealType) {
    setAmbiance((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= MAX_AMBIANCE) return prev; // plafond à 3
      return [...prev, t];
    });
  }

  function toggleExclusion(ids: string[]) {
    setExcluded((prev) => {
      const has = ids.every((id) => prev.includes(id));
      return has ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])];
    });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-5">
        <div className="flex items-center gap-3">
          {step > 0 ? (
            <button
              onClick={() => go(-1)}
              aria-label="Retour"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-surface-variant"
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <div className="h-11 w-11 shrink-0" aria-hidden />
          )}
          {/* Barre de progression animée */}
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-variant">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              initial={false}
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="h-11 w-11 shrink-0" aria-hidden />
        </div>
        <p className="text-center text-xs font-medium text-on-surface-muted" aria-live="polite">
          Étape {step + 1} sur {STEPS.length}
        </p>
      </header>

      <main className="flex-1 overflow-hidden px-5 pt-8">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-md lg:max-w-lg"
          >
            {step === 0 && (
              <Step title="Dans quel pays ?" subtitle="On charge les enseignes de ton pays.">
                <div className="grid grid-cols-2 gap-3">
                  {COUNTRIES.map((c) => (
                    <ChoiceCard
                      key={c}
                      emoji={COUNTRY_LABELS[c].flag}
                      label={COUNTRY_LABELS[c].label}
                      selected={country === c}
                      onClick={() => {
                        setCountry(c);
                        setStoreId("");
                      }}
                    />
                  ))}
                </div>
              </Step>
            )}

            {step === 1 && (
              <Step
                title="Où fais-tu tes courses ?"
                subtitle={`${storesForCountry.length} enseignes en ${COUNTRY_LABELS[country].label}. On adapte les prix.`}
              >
                <div className="-mx-1 max-h-[58dvh] space-y-2.5 overflow-y-auto px-1 pb-2">
                  {storesForCountry.map((s) => (
                    <Tappable key={s.id}>
                      <button
                        type="button"
                        aria-pressed={storeId === s.id}
                        onClick={() => setStoreId(s.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[var(--radius-card)] border p-3 text-left transition-colors",
                          storeId === s.id
                            ? "border-primary bg-primary/8 ring-2 ring-primary"
                            : "border-outline bg-surface hover:bg-surface-variant",
                        )}
                      >
                        <BrandLogo domain={s.domain} name={s.name} color={s.color} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.name}</span>
                          <span className="block text-xs text-on-surface-muted">
                            {STORE_KIND_LABELS[s.kind]}
                          </span>
                        </span>
                        {storeId === s.id && (
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    </Tappable>
                  ))}
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step title="Quel budget cette semaine ?" subtitle="Tu pourras l'ajuster à tout moment.">
                <div className="mt-2 text-center">
                  <CountUp
                    value={budget}
                    duration={0.3}
                    format={formatEuro}
                    className="tnum font-display text-6xl font-semibold tracking-tight text-primary"
                  />
                  <p className="mt-1 text-on-surface-muted">cette semaine</p>
                </div>
                <input
                  id="budget"
                  type="range"
                  min={25}
                  max={100}
                  step={5}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  aria-label="Budget de la semaine en euros"
                  className="mt-8 h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-variant accent-primary"
                />
                <div className="mt-2 flex justify-between text-xs text-on-surface-muted">
                  <span>25 €</span>
                  <span>100 €</span>
                </div>
              </Step>
            )}

            {step === 3 && (
              <Step title="Vous êtes combien ?" subtitle="Pour ajuster les quantités et les prix.">
                <div className="mt-2 text-center">
                  <CountUp
                    value={householdSize}
                    duration={0.25}
                    format={(v) => String(Math.round(v))}
                    className="tnum font-display text-6xl font-semibold tracking-tight"
                  />
                  <p className="mt-1 text-on-surface-muted">
                    {householdSize > 1 ? "personnes" : "personne"}
                  </p>
                </div>
                <div className="mt-8 flex items-center justify-center gap-8">
                  <RoundStep
                    label="Retirer une personne"
                    icon={<Minus size={22} />}
                    disabled={householdSize <= 1}
                    onClick={() => setHouseholdSize((v) => Math.max(1, v - 1))}
                  />
                  <RoundStep
                    label="Ajouter une personne"
                    icon={<Plus size={22} />}
                    disabled={householdSize >= 10}
                    onClick={() => setHouseholdSize((v) => Math.min(10, v + 1))}
                  />
                </div>
              </Step>
            )}

            {step === 4 && (
              <Step
                title="Quels repas planifier ?"
                subtitle="On génère des recettes adaptées à chaque moment."
              >
                <div className="space-y-3">
                  {MEAL_SLOT_ORDER.map((s) => {
                    const selected = mealSlots.includes(s);
                    return (
                      <Tappable key={s}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleSlot(s)}
                          className={cn(
                            "relative flex w-full items-center gap-3 rounded-[var(--radius-card)] border p-4 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/8 ring-2 ring-primary"
                              : "border-outline bg-surface hover:bg-surface-variant",
                          )}
                        >
                          <span className="text-2xl" aria-hidden>
                            {MEAL_SLOT_LABELS[s].emoji}
                          </span>
                          <span className="font-medium">{MEAL_SLOT_LABELS[s].label}</span>
                          {selected && (
                            <span className="absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-primary text-on-primary">
                              <Check size={13} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      </Tappable>
                    );
                  })}
                </div>
              </Step>
            )}

            {step === 5 && (
              <Step
                title="Quelle ambiance ?"
                subtitle={`Choisis jusqu'à ${MAX_AMBIANCE} options. (facultatif)`}
              >
                <div className="grid grid-cols-2 gap-3">
                  {AMBIANCES.map((a) => {
                    const selected = ambiance.includes(a.type);
                    const atCap = ambiance.length >= MAX_AMBIANCE && !selected;
                    return (
                      <Tappable key={a.type}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          disabled={atCap}
                          onClick={() => toggleAmbiance(a.type)}
                          className={cn(
                            "relative flex h-full w-full flex-col items-start gap-2 rounded-[var(--radius-card)] border p-4 text-left transition-all",
                            selected
                              ? cn("ring-2", a.tintActive, "text-on-surface")
                              : cn(a.tint, "text-on-surface hover:brightness-[0.98]"),
                            atCap && "opacity-40",
                          )}
                        >
                          <span className="text-3xl" aria-hidden>
                            {a.emoji}
                          </span>
                          <span className="font-semibold leading-tight text-stone-800">
                            {a.label}
                          </span>
                          {a.hint && (
                            <span className="text-xs font-medium text-stone-600">{a.hint}</span>
                          )}
                          {selected && (
                            <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-on-primary">
                              <Check size={13} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      </Tappable>
                    );
                  })}
                </div>
              </Step>
            )}

            {step === 6 && (
              <Step
                title="Des besoins alimentaires ?"
                subtitle="Plusieurs choix possibles. Laisse vide sinon."
              >
                <div className="grid grid-cols-2 gap-3">
                  {DIETS.map((d) => (
                    <ChoiceCard
                      key={d}
                      emoji={DIET_LABELS[d].emoji}
                      label={DIET_LABELS[d].label}
                      selected={diets.includes(d)}
                      onClick={() =>
                        setDiets((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                        )
                      }
                    />
                  ))}
                </div>
              </Step>
            )}

            {step === 7 && (
              <Step
                title="À éviter ?"
                subtitle="Allergènes ou aliments que tu ne veux pas. (facultatif)"
              >
                <div className="grid grid-cols-2 gap-3">
                  {EXCLUSIONS.map((ex) => (
                    <ChoiceCard
                      key={ex.key}
                      emoji={ex.emoji}
                      label={ex.label}
                      selected={ex.ingredientIds.every((id) => excluded.includes(id))}
                      onClick={() => toggleExclusion(ex.ingredientIds)}
                    />
                  ))}
                </div>
              </Step>
            )}

            {step === 8 && (
              <Step
                title="Quel équipement as-tu ?"
                subtitle="On exclut les recettes que tu ne peux pas cuisiner."
              >
                <div className="grid grid-cols-2 gap-3">
                  {APPLIANCES.map((a) => (
                    <ChoiceCard
                      key={a}
                      icon={<ApplianceIcon appliance={a} size={26} />}
                      label={APPLIANCE_LABELS[a].label}
                      selected={equipment.includes(a)}
                      onClick={() =>
                        setEquipment((prev) =>
                          prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
                        )
                      }
                    />
                  ))}
                </div>
              </Step>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="sticky bottom-0 border-t border-outline bg-background/80 p-5 backdrop-blur">
        <Button onClick={next} disabled={!canContinue || pending} size="lg" className="w-full">
          {pending
            ? "Préparation…"
            : step < STEPS.length - 1
              ? "Continuer"
              : "Générer le plan"}
        </Button>
      </footer>
    </div>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-display text-[1.7rem] font-semibold leading-[1.15] tracking-tight">
        {title}
      </h1>
      <p className="mt-1.5 text-on-surface-muted">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function ChoiceCard({
  emoji,
  icon,
  label,
  selected,
  onClick,
}: {
  emoji?: string;
  icon?: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Tappable className="h-full">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={cn(
          "relative flex h-full w-full items-center gap-3 rounded-[var(--radius-card)] border p-4 text-left transition-colors",
          selected
            ? "border-primary bg-primary/8 ring-2 ring-primary"
            : "border-outline bg-surface hover:bg-surface-variant",
        )}
      >
        <span
          className={cn("grid place-items-center", selected ? "text-primary" : "text-on-surface")}
        >
          {icon ?? (
            <span className="text-2xl" aria-hidden>
              {emoji}
            </span>
          )}
        </span>
        <span className="font-medium">{label}</span>
        {selected && (
          <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-on-primary">
            <Check size={13} strokeWidth={3} />
          </span>
        )}
      </button>
    </Tappable>
  );
}

function RoundStep({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className="grid h-16 w-16 place-items-center rounded-full border-2 border-outline bg-surface text-on-surface transition-colors hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-outline disabled:hover:text-on-surface"
    >
      {icon}
    </motion.button>
  );
}
