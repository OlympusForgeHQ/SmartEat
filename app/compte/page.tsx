import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  ListChecks,
  LogOut,
  Pencil,
  UtensilsCrossed,
} from "lucide-react";
import { getPrefs } from "@/lib/prefs";
import { getCurrentUser } from "@/lib/supabase/server";
import { repo } from "@/lib/repo";
import { signOut } from "@/app/actions";
import { buildPrefsSummary } from "@/lib/summary";
import { PrefsSummary } from "@/components/prefs-summary";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClasses } from "@/components/ui/button";

// Dashboard du compte : profil en tête, sections en cartes, jamais bloquant.
export default async function ComptePage() {
  const [user, prefs, stores] = await Promise.all([
    getCurrentUser(),
    getPrefs(),
    repo.getStores(),
  ]);
  const store = prefs ? stores.find((s) => s.id === prefs.storeId) : undefined;
  const summary = prefs ? buildPrefsSummary(prefs, store) : null;
  const monogram = user?.email?.[0]?.toUpperCase();

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8 pb-28 lg:max-w-3xl lg:px-8 lg:py-12">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-on-surface-muted hover:text-on-surface"
      >
        <ChevronLeft size={16} /> Accueil
      </Link>

      {/* ---------- PROFIL ---------- */}
      <div className="mt-2 flex flex-col items-center text-center">
        <span
          className="grid h-20 w-20 place-items-center rounded-full border border-outline bg-primary/10 shadow-[var(--shadow-sm)]"
          aria-hidden
        >
          {monogram ? (
            <span className="font-display text-3xl font-semibold text-primary">{monogram}</span>
          ) : (
            <span className="text-3xl">🧑‍🍳</span>
          )}
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Mon compte</h1>
        <p className="mt-1 text-sm text-on-surface-muted">
          {user ? (
            <>
              Connecté · <span className="font-medium text-on-surface">{user.email}</span>
            </>
          ) : (
            "Mode invité (sur cet appareil)"
          )}
        </p>
      </div>

      {/* ---------- TES CHOIX ---------- */}
      <Section title="Tes choix">
        {summary ? (
          <>
            <PrefsSummary summary={summary} />
            <Link href="/onboarding" className={`${buttonClasses("secondary", "md")} mt-3 w-full`}>
              <Pencil size={16} /> Modifier mes préférences
            </Link>
          </>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-dashed border-outline bg-surface p-6 text-center">
            <p className="font-medium">Tu n&apos;as pas encore configuré tes repas.</p>
            <Link href="/onboarding" className={`${buttonClasses("primary", "lg")} mt-4 w-full`}>
              Commencer
            </Link>
          </div>
        )}
      </Section>

      {/* ---------- RACCOURCIS ---------- */}
      <Section title="Raccourcis">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-outline bg-surface">
          {summary && (
            <ShortcutRow
              href="/plan"
              icon={<UtensilsCrossed size={17} />}
              label="Mes repas de la semaine"
            />
          )}
          {summary && (
            <ShortcutRow
              href="/listes"
              icon={<ListChecks size={17} />}
              label="Mes listes de courses"
            />
          )}
          <ShortcutRow href="/recettes" icon={<ImageIcon size={17} />} label="Toutes les recettes" />
        </div>
      </Section>

      {/* ---------- THÈME ---------- */}
      <Section title="Thème">
        <div className="flex min-h-[52px] items-center justify-between gap-3 rounded-[var(--radius-card)] border border-outline bg-surface px-4 py-3">
          <span className="text-sm font-medium">Apparence de l&apos;app</span>
          <ThemeToggle compact />
        </div>
      </Section>

      {/* ---------- SESSION ---------- */}
      <Section title="Session">
        <div className="rounded-[var(--radius-card)] border border-outline bg-surface p-4">
          {user ? (
            <form action={signOut}>
              <button type="submit" className={`${buttonClasses("ghost", "md")} w-full text-error`}>
                <LogOut size={16} /> Se déconnecter
              </button>
            </form>
          ) : (
            <Link href="/login" className={`${buttonClasses("secondary", "md")} w-full`}>
              Se connecter / créer un compte
            </Link>
          )}
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function ShortcutRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[52px] items-center gap-3 border-b border-outline px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-variant"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      <ChevronRight size={16} className="shrink-0 text-on-surface-muted" aria-hidden />
    </Link>
  );
}
