"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ACTIVITY_LEVELS,
  AJUSTEMENTS,
  buildDietPlan,
  type DietPlan,
  inputValide,
  LIMITES,
  type DietInput,
  type Objectif,
  type PreferenceAlimentaire,
  type Sexe,
} from "@/lib/diet-calculator";
import { CountUp } from "@/components/ui/count-up";
import { Stagger, StaggerItem, Tappable } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

// Calculateur Diet Legacy — piste « Bilan express » (voir
// docs/design-proposals/4-designs-calculateur.html) : une seule page, les cinq
// blocs numérotés du classeur d'origine, et un résultat recalculé en direct à
// chaque geste (pas de bouton « calculer »). Le moteur vit dans
// lib/diet-calculator.ts, vérifié à la kcal près contre le classeur.

const STORAGE_KEY = "smarteat-diet-calc-v1";

const EASE = [0.22, 1, 0.36, 1] as const;

// Saisie brute du formulaire : les mesures restent des chaînes pour laisser
// l'utilisateur vider/retaper librement, la conversion se fait au calcul.
interface Draft {
  sexe: Sexe;
  taille: string;
  poids: string;
  age: string;
  coefficient: number;
  objectif: Objectif;
  ajustement: number;
  preference: PreferenceAlimentaire;
}

const DEFAUT: Draft = {
  sexe: "homme",
  taille: "",
  poids: "",
  age: "",
  coefficient: 1.2,
  objectif: "perte",
  ajustement: 0,
  preference: "aucune",
};

const nombre = new Intl.NumberFormat("fr-FR");
const pourcent = (v: number) =>
  `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

function parseMesure(raw: string): number {
  return Number(raw.replace(",", "."));
}

export function DietCalculator() {
  const [draft, setDraft] = useState<Draft>(DEFAUT);

  // Reprise de la dernière saisie (même appareil), après hydratation.
  // localStorage est indisponible pendant le SSR : même pattern (et même
  // dérogation lint) que ThemeToggle.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDraft({ ...DEFAUT, ...(JSON.parse(saved) as Partial<Draft>) });
    } catch {
      // stockage indisponible : le formulaire démarre simplement vide
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // idem : la persistance est un confort, jamais bloquante
    }
  }, [draft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const mesures = {
    tailleCm: parseMesure(draft.taille),
    poidsKg: parseMesure(draft.poids),
    age: parseMesure(draft.age),
  };
  const pretes = draft.taille !== "" && draft.poids !== "" && draft.age !== "";
  const valide = pretes && inputValide(mesures);

  // Calcul direct à chaque rendu : 8-9 itérations, aucun besoin de mémo.
  const input: DietInput = {
    sexe: draft.sexe,
    ...mesures,
    coefficient: draft.coefficient,
    objectif: draft.objectif,
    ajustement: draft.ajustement,
    preference: draft.preference,
  };
  const plan = valide ? buildDietPlan(input) : null;

  const perte = draft.objectif === "perte";

  return (
    <div>
      {/* ---------- 1. TOI ---------- */}
      <SectionLabel n={1} title="Toi" />
      <Segmented
        ariaLabel="Sexe"
        value={draft.sexe}
        onChange={(v) => set("sexe", v)}
        options={[
          { value: "homme" as const, label: "Homme" },
          { value: "femme" as const, label: "Femme" },
        ]}
      />
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Mesure
          id="taille"
          label="Taille"
          unit="cm"
          value={draft.taille}
          onChange={(v) => set("taille", v)}
          min={LIMITES.tailleCm.min}
          max={LIMITES.tailleCm.max}
          placeholder="178"
        />
        <Mesure
          id="poids"
          label="Poids"
          unit="kg"
          value={draft.poids}
          onChange={(v) => set("poids", v)}
          min={LIMITES.poidsKg.min}
          max={LIMITES.poidsKg.max}
          placeholder="80"
          decimales
        />
        <Mesure
          id="age"
          label="Âge"
          unit="ans"
          value={draft.age}
          onChange={(v) => set("age", v)}
          min={LIMITES.age.min}
          max={LIMITES.age.max}
          placeholder="36"
        />
      </div>

      {/* ---------- 2. ACTIVITÉ ---------- */}
      <SectionLabel n={2} title="Coefficient d'activité" className="mt-8" />
      <div className="space-y-2.5">
        {ACTIVITY_LEVELS.map((niveau) => {
          const on = draft.coefficient === niveau.coefficient;
          return (
            <Tappable key={niveau.coefficient}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => set("coefficient", niveau.coefficient)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  on
                    ? "border-primary bg-primary/8 ring-2 ring-primary"
                    : "border-outline bg-surface hover:bg-surface-variant",
                )}
              >
                <span className="min-w-0 flex-1 font-medium">{niveau.label}</span>
                <span
                  className={cn(
                    "tnum shrink-0 text-sm font-bold",
                    on ? "text-primary" : "text-on-surface-muted",
                  )}
                >
                  ×{niveau.coefficient.toLocaleString("fr-FR")}
                </span>
              </button>
            </Tappable>
          );
        })}
      </div>

      {/* ---------- Résultat en direct : BMR / TDEE ---------- */}
      <AnimatePresence initial={false}>
        {plan && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-5 flex items-baseline gap-2 rounded-[var(--radius-card)] border border-primary/25 bg-primary/10 px-5 py-4">
              <CountUp
                value={plan.tdee}
                duration={0.5}
                format={(v) => nombre.format(Math.round(v))}
                className="tnum font-display text-4xl font-semibold tracking-tight text-primary"
              />
              <span className="text-xs font-semibold text-on-surface-muted">
                kcal dépensées / jour
              </span>
              <span className="tnum ml-auto text-right text-xs leading-5 text-on-surface-muted">
                BMR{" "}
                <span className="font-semibold text-on-surface">{nombre.format(plan.bmr)}</span>
                <br />
                en direct
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- 3. OBJECTIF ---------- */}
      <SectionLabel n={3} title="Objectif" className="mt-8" />
      <Segmented
        ariaLabel="Objectif"
        value={draft.objectif}
        onChange={(v) => set("objectif", v)}
        options={[
          { value: "perte" as const, label: "Perte de poids" },
          { value: "prise" as const, label: "Prise de poids" },
        ]}
      />
      <p className="mt-2 text-xs text-on-surface-muted">
        {perte
          ? "8 semaines, calories en recul de 1 % par semaine."
          : "9 semaines, calories en hausse de 2 % par semaine."}
      </p>

      {/* ---------- 4. AJUSTEMENT ---------- */}
      <SectionLabel
        n={4}
        title={perte ? "Déficit supplémentaire" : "Surplus supplémentaire"}
        className="mt-8"
      />
      <div
        role="group"
        aria-label={perte ? "Déficit calorique supplémentaire" : "Surplus calorique supplémentaire"}
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {AJUSTEMENTS.map((a) => {
          const on = draft.ajustement === a;
          return (
            <button
              key={a}
              type="button"
              aria-pressed={on}
              onClick={() => set("ajustement", a)}
              className={cn(
                "tnum h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                on
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline bg-surface text-on-surface-muted hover:bg-surface-variant",
              )}
            >
              {a === 0 ? "Aucun" : pourcent(a)}
            </button>
          );
        })}
      </div>

      {/* ---------- 5. PRÉFÉRENCE ---------- */}
      <SectionLabel n={5} title="Préférence alimentaire" className="mt-7" />
      <Segmented
        ariaLabel="Préférence alimentaire"
        value={draft.preference}
        onChange={(v) => set("preference", v)}
        options={[
          { value: "glucides" as const, label: "Glucides" },
          { value: "aucune" as const, label: "Aucune" },
          { value: "lipides" as const, label: "Lipides" },
        ]}
      />
      <p className="mt-2 text-xs text-on-surface-muted">
        Répartit les calories restantes après tes protéines (fixées à 2 g par kilo).
      </p>

      {/* ---------- PLAN ---------- */}
      <div className="mt-10">
        {plan ? (
          <PlanResultats
            plan={plan}
            perte={perte}
            poidsKg={mesures.poidsKg}
            ajustement={draft.ajustement}
          />
        ) : (
          <div className="rounded-[var(--radius-card)] border border-dashed border-outline bg-surface p-6 text-center">
            <p className="font-medium">
              {pretes ? "Vérifie tes mesures." : "Complète tes mesures pour voir ton plan."}
            </p>
            <p className="mt-1 text-sm text-on-surface-muted">
              {pretes
                ? `Taille ${LIMITES.tailleCm.min}–${LIMITES.tailleCm.max} cm, poids ${LIMITES.poidsKg.min}–${LIMITES.poidsKg.max} kg, âge ${LIMITES.age.min}–${LIMITES.age.max} ans.`
                : "Taille, poids et âge suffisent : le calcul se fait tout seul."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Résultats : héros semaine 1, tuiles, timeline des semaines         */
/* ------------------------------------------------------------------ */

function PlanResultats({
  plan,
  perte,
  poidsKg,
  ajustement,
}: {
  plan: DietPlan;
  perte: boolean;
  poidsKg: number;
  ajustement: number;
}) {
  const s1 = plan.semaines[0];
  return (
    <section aria-label="Ton plan">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        {perte ? "Tes 8 semaines" : "Tes 9 semaines"}
      </h2>
      <p className="mt-1 text-sm text-on-surface-muted">
        {ajustement > 0
          ? `Départ à ${perte ? "−" : "+"}${pourcent(ajustement)} du TDEE, puis ${perte ? "−1" : "+2"} % chaque semaine.`
          : `Départ au TDEE, puis ${perte ? "−1" : "+2"} % chaque semaine.`}
      </p>

      {/* Héros : kcal de la semaine 1 + tuiles (idiome carte nutrition) */}
      <div className="mt-4 rounded-[var(--radius-card)] border border-outline bg-surface p-4 shadow-[var(--shadow-md)]">
        <div className="flex items-baseline justify-center gap-1.5 rounded-2xl bg-primary/10 py-3">
          <CountUp
            value={s1.kcal}
            duration={0.6}
            format={(v) => nombre.format(Math.round(v))}
            className="tnum font-display text-3xl font-semibold tracking-tight text-primary"
          />
          <span className="text-sm font-semibold text-on-surface-muted">kcal / jour · semaine 1</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Tuile label="Masse maigre" value={`${plan.lbm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`} />
          <Tuile label="BMR" value={`${nombre.format(plan.bmr)} kcal`} />
          <Tuile label="TDEE" value={`${nombre.format(plan.tdee)} kcal`} />
        </div>
        <p className="mt-3 text-center text-[11px] text-on-surface-muted">
          Protéines fixes : 2 g/kg, soit {nombre.format(Math.round(2 * poidsKg))} g par jour.
        </p>
      </div>

      {plan.macrosEcretees && (
        <div className="mt-3 rounded-[var(--radius-card)] border border-accent/30 bg-accent/10 p-4 text-sm">
          <p className="font-semibold">Déficit trop agressif pour ce profil.</p>
          <p className="mt-1 text-on-surface-muted">
            Certaines semaines ne couvrent plus tes protéines : réduis le déficit supplémentaire ou
            revois l&apos;objectif.
          </p>
        </div>
      )}

      {/* Timeline horizontale des semaines */}
      <Stagger
        className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Calories et macros par semaine"
      >
        {plan.semaines.map((s) => (
          <StaggerItem
            key={s.numero}
            role="listitem"
            className="w-[136px] shrink-0 snap-start rounded-[var(--radius-card)] border border-outline bg-surface p-3.5"
          >
            <span
              className={cn(
                "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                s.numero === 1
                  ? "bg-primary text-on-primary"
                  : "bg-surface-variant text-on-surface-muted",
              )}
            >
              S{s.numero}
            </span>
            <p className="tnum mt-2 text-lg font-bold leading-none">
              {nombre.format(s.kcal)}{" "}
              <span className="text-[11px] font-semibold text-on-surface-muted">kcal</span>
            </p>
            <dl className="tnum mt-2.5 space-y-1 text-xs text-on-surface-muted">
              <div className="flex justify-between">
                <dt>Protéines</dt>
                <dd className="font-semibold text-on-surface">{s.proteinesG} g</dd>
              </div>
              <div className="flex justify-between">
                <dt>Glucides</dt>
                <dd className="font-semibold text-on-surface">{s.glucidesG} g</dd>
              </div>
              <div className="flex justify-between">
                <dt>Lipides</dt>
                <dd className="font-semibold text-on-surface">{s.lipidesG} g</dd>
              </div>
            </dl>
          </StaggerItem>
        ))}
      </Stagger>

      <p className="mt-4 text-center text-[11px] leading-5 text-on-surface-muted">
        Méthode Diet Legacy : masse maigre (Boer), métabolisme (Katch-McArdle), coefficient
        d&apos;activité. Estimations à ajuster selon tes sensations et tes résultats.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Petits composants de formulaire                                    */
/* ------------------------------------------------------------------ */

function SectionLabel({ n, title, className }: { n: number; title: string; className?: string }) {
  return (
    <div className={cn("mb-2.5 flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="tnum grid h-5 w-5 place-items-center rounded-full bg-surface-variant text-[11px] font-bold"
      >
        {n}
      </span>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-muted">
        {title}
      </h2>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid gap-1 rounded-full border border-outline bg-surface p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-10 truncate rounded-full px-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              on
                ? "bg-primary text-on-primary shadow-[var(--shadow-sm)]"
                : "text-on-surface-muted hover:bg-surface-variant",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Mesure({
  id,
  label,
  unit,
  value,
  onChange,
  min,
  max,
  placeholder,
  decimales = false,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  placeholder: string;
  decimales?: boolean;
}) {
  const n = parseMesure(value);
  const horsBornes = value !== "" && (!Number.isFinite(n) || n < min || n > max);
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          "flex flex-col gap-0.5 rounded-2xl border bg-surface px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-primary",
          horsBornes ? "border-error" : "border-outline focus-within:border-primary",
        )}
      >
        <span className="text-[11px] font-medium text-on-surface-muted">{label}</span>
        <span className="flex items-baseline gap-1">
          <input
            id={id}
            type="text"
            inputMode={decimales ? "decimal" : "numeric"}
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              const brut = e.target.value.replace(/[^0-9.,]/g, "");
              onChange(brut.slice(0, 5));
            }}
            aria-invalid={horsBornes || undefined}
            aria-describedby={horsBornes ? `${id}-err` : undefined}
            className="tnum w-full min-w-0 bg-transparent text-lg font-bold outline-none placeholder:font-semibold placeholder:text-on-surface-muted/40"
          />
          <span className="text-[11px] font-semibold text-on-surface-muted">{unit}</span>
        </span>
      </label>
      {horsBornes && (
        <p id={`${id}-err`} className="tnum mt-1 text-[11px] font-medium text-error">
          Entre {min} et {max} {unit}.
        </p>
      )}
    </div>
  );
}

function Tuile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-variant/60 p-3 text-center">
      <div className="tnum text-sm font-semibold">{value}</div>
      <div className="mt-0.5 text-[11px] text-on-surface-muted">{label}</div>
    </div>
  );
}
