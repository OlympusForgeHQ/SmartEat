import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DietCalculator } from "@/components/diet-calculator";

export const metadata: Metadata = {
  title: "Calculateur diète — SmartEat",
  description:
    "Calcule ta dépense énergétique (méthode Diet Legacy) et ton plan calories & macros sur 8 ou 9 semaines.",
};

// Onglet Diète : page fine côté serveur, tout le calculateur est client
// (calcul en direct, aucune donnée à charger).
export default function CalculateurPage() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-8 pb-28">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-on-surface-muted hover:text-on-surface"
      >
        <ChevronLeft size={16} /> Accueil
      </Link>

      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        Calculateur diète
      </h1>
      <p className="mt-1 text-sm text-on-surface-muted">
        Ton plan calories &amp; macros, méthode Diet Legacy. Le résultat se met à jour pendant que
        tu remplis.
      </p>

      <div className="mt-7">
        <DietCalculator />
      </div>
    </main>
  );
}
