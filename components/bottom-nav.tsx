"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Calculator, Home, ListChecks, UserRound, UtensilsCrossed } from "lucide-react";

// Barre d'onglets fixe en bas (shell app-like, voir REFONTE.md §5).
// Cachée sur les flux plein écran (onboarding, login, génération, auth).

const ITEMS: {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
}[] = [
  { href: "/", label: "Accueil", icon: Home, isActive: (p) => p === "/" },
  {
    href: "/plan",
    label: "Repas",
    icon: UtensilsCrossed,
    isActive: (p) => p.startsWith("/plan") || p.startsWith("/recipe"),
  },
  { href: "/recettes", label: "Recettes", icon: BookOpen, isActive: (p) => p.startsWith("/recettes") },
  {
    href: "/listes",
    label: "Listes",
    icon: ListChecks,
    isActive: (p) => p.startsWith("/listes") || p === "/list" || p.startsWith("/list/"),
  },
  {
    href: "/calculateur",
    label: "Diète",
    icon: Calculator,
    isActive: (p) => p.startsWith("/calculateur"),
  },
  { href: "/compte", label: "Compte", icon: UserRound, isActive: (p) => p.startsWith("/compte") },
];

const HIDDEN_PREFIXES = ["/onboarding", "/login", "/generating", "/auth"];

export function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline bg-surface/92 backdrop-blur"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-6">
        {ITEMS.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? "text-primary" : "text-on-surface-muted hover:text-on-surface"
              }`}
            >
              <span
                className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                  active ? "bg-primary/12" : ""
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
