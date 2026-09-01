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
import { Stagger, StaggerItem } from "@/components/ui/motion";
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
  const coeffIdx = Math.max(
    0,
    ACTIVITY_LEVELS.findIndex((n) => n.coefficient === draft.coefficient),
  );

  return (
    // Mobile : une colonne. Desktop (lg) : formulaire à gauche, plan sticky à
    // droite — chaque réglage se reflète sans défilement (piste Bilan express).
    <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-14">
      <div>
      {/* Pastille sticky (mobile) : le résultat suit pendant les réglages,
          un appui mène au plan complet. Le desktop a son panneau permanent. */}
      <AnimatePresence initial={false}>
        {plan && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="sticky top-3 z-20 mb-5 lg:hidden"
          >
            <a
              href="#plan"
              aria-label="Voir le plan complet"
              className="flex items-baseline gap-2 rounded-full border border-primary/25 bg-surface px-5 py-3 shadow-[var(--shadow-md)] transition-transform active:scale-[0.98]"
            >
              <CountUp
                value={plan.semaines[0].kcal}
                duration={0.5}
                format={(v) => nombre.format(Math.round(v))}
                className="tnum font-display text-xl font-semibold tracking-tight text-primary"
              />
              <span className="text-xs font-semibold text-on-surface-muted">
                kcal / jour · semaine 1
              </span>
              <span className="tnum ml-auto shrink-0 text-xs font-semibold text-on-surface-muted">
                TDEE {nombre.format(plan.tdee)}
              </span>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* ---------- 2. ACTIVITÉ — curseur 5 crans (idiome slider budget) ---------- */}
      <SectionLabel n={2} title="Coefficient d'activité" className="mt-8" />
      <div className="rounded-[var(--radius-card)] border border-outline bg-surface px-4 pb-3.5 pt-4">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
            {ACTIVITY_LEVELS[coeffIdx].label}
          </span>
          <span className="tnum shrink-0 font-display text-2xl font-semibold tracking-tight text-primary">
            ×{ACTIVITY_LEVELS[coeffIdx].coefficient.toLocaleString("fr-FR")}
          </span>
        </div>
        <input
          id="coefficient"
          type="range"
          min={0}
          max={ACTIVITY_LEVELS.length - 1}
          step={1}
          value={coeffIdx}
          onChange={(e) => set("coefficient", ACTIVITY_LEVELS[Number(e.target.value)].coefficient)}
          aria-label="Coefficient d'activité"
          aria-valuetext={`${ACTIVITY_LEVELS[coeffIdx].label} (coefficient ${ACTIVITY_LEVELS[coeffIdx].coefficient.toLocaleString("fr-FR")})`}
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-variant accent-primary"
        />
        <div className="tnum mt-1.5 flex justify-between text-[11px] text-on-surface-muted">
          {ACTIVITY_LEVELS.map((n) => (
            <span key={n.coefficient}>×{n.coefficient.toLocaleString("fr-FR")}</span>
          ))}
        </div>
      </div>

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
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
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

      </div>

      {/* ---------- PLAN — panneau permanent à droite sur desktop ---------- */}
      <div id="plan" className="mt-10 scroll-mt-20 lg:sticky lg:top-10 lg:mt-0">
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

      {/* Mobile : relevé tableau — les semaines se comparent d'un regard,
          sans défilement caché (piste « Fiche mesure » de la galerie). */}
      <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-outline bg-surface lg:hidden">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Calories et macros par semaine</caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-on-surface-muted">
              <th scope="col" className="py-2.5 pl-4 text-left font-semibold">
                Sem.
              </th>
              <th scope="col" className="py-2.5 text-right font-semibold">
                kcal
              </th>
              <th scope="col" className="py-2.5 text-right font-semibold">
                Prot.
              </th>
              <th scope="col" className="py-2.5 text-right font-semibold">
                Gluc.
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-semibold">
                Lip.
              </th>
            </tr>
          </thead>
          <tbody className="tnum">
            {plan.semaines.map((s) => (
              <tr
                key={s.numero}
                className={cn("border-t border-outline", s.numero === 1 && "bg-primary/8")}
              >
                <td
                  className={cn(
                    "py-2.5 pl-4 font-bold",
                    s.numero === 1 ? "text-primary" : "text-on-surface-muted",
                  )}
                >
                  S{s.numero}
                </td>
                <td className="py-2.5 text-right font-bold">{nombre.format(s.kcal)}</td>
                <td className="py-2.5 text-right text-on-surface-muted">{s.proteinesG}</td>
                <td className="py-2.5 text-right text-on-surface-muted">{s.glucidesG}</td>
                <td className="py-2.5 pr-4 text-right text-on-surface-muted">{s.lipidesG}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-on-surface-muted lg:hidden">
        Macros en grammes par jour.
      </p>

      {/* Desktop : grille sans défilement, rangées pleines (8 sem -> 4x2, 9 sem -> 3x3) */}
      <Stagger
        className={cn(
          "mt-4 hidden gap-3 lg:grid",
          plan.semaines.length === 9 ? "lg:grid-cols-3" : "lg:grid-cols-4",
        )}
        role="list"
        aria-label="Calories et macros par semaine"
      >
        {plan.semaines.map((s) => (
          <StaggerItem
            key={s.numero}
            role="listitem"
            className="rounded-[var(--radius-card)] border border-outline bg-surface p-3.5"
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
                <dd className="whitespace-nowrap font-semibold text-on-surface">{s.proteinesG} g</dd>
              </div>
              <div className="flex justify-between">
                <dt>Glucides</dt>
                <dd className="whitespace-nowrap font-semibold text-on-surface">{s.glucidesG} g</dd>
              </div>
              <div className="flex justify-between">
                <dt>Lipides</dt>
                <dd className="whitespace-nowrap font-semibold text-on-surface">{s.lipidesG} g</dd>
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
