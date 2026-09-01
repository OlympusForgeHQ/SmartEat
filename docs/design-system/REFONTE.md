# SmartEat 3.0 — Refonte « Fraîcheur éditoriale »

Brief de référence pour la refonte complète (2026-07). Toute page ou composant
restylé DOIT suivre ce document. Les noms de tokens sont INCHANGÉS par rapport
à l'ancien design — seules les valeurs et l'usage évoluent.

## 1. Direction

Un magazine food chaleureux, pas un dashboard. Fond crème, vert basilic profond,
terracotta en accent, photos de plats mises en avant en grand, titres en serif
éditorial (Fraunces), corps en Inter. Mobile-first (max-w-md), app-like avec une
barre d'onglets fixe en bas.

## 2. Tokens (définis dans app/globals.css — NE PAS les redéfinir ailleurs)

| Rôle | Clair | Sombre |
|---|---|---|
| `--background` | crème `#faf6ee` | charbon chaud `#12100c` |
| `--surface` | `#ffffff` | `#1c1915` |
| `--surface-variant` | `#f2ecdf` | `#29241d` |
| `--on-surface` | `#221f1a` | `#f2ede2` |
| `--on-surface-muted` | `#7a7266` | `#a69d8d` |
| `--outline` | `#e6ddcc` | `#3a342a` |
| `--primary` | basilic `#1b7a4e` | menthe `#46c483` |
| `--accent` | terracotta `#d9542e` | `#f07e52` |

Utilitaires Tailwind disponibles : `bg-background`, `bg-surface`,
`bg-surface-variant`, `text-on-surface`, `text-on-surface-muted`,
`border-outline`, `bg-primary`, `text-primary`, `text-on-primary`,
`text-accent`, `text-error` — et leurs modificateurs d'opacité
(`bg-primary/10`, `border-primary/30`…).

## 3. Typographie

- **Titres (h1/h2 de page, gros chiffres)** : `font-display` (Fraunces, serif
  éditorial) + `font-semibold` + `tracking-tight`. Ex. :
  `className="font-display text-3xl font-semibold tracking-tight"`.
- **Tout le reste** : Inter (défaut). Prix/quantités : classe `tnum`.
- Majuscule en début de phrase partout (règle produit).

## 4. Formes, ombres, mouvement

- Cartes : `rounded-[var(--radius-card)]` (24px) `border border-outline
  bg-surface`, ombre douce `shadow-[var(--shadow-md)]` pour les cartes
  « héros », rien pour les cartes secondaires.
- Boutons : pilules (déjà géré par `buttonClasses`) — primary plein,
  secondary tonal vert, ghost.
- Photos : les mettre en avant, grandes (`aspect-[4/3]` ou `aspect-[16/10]`),
  via `RecipeImage` (fallback dégradé+emoji intégré).
- Motion : conserver les patterns framer-motion existants
  (`Reveal`, `Stagger`, `StaggerItem`, ease `[0.22,1,0.36,1]`).

## 5. Shell de navigation (NOUVEAU)

`components/bottom-nav.tsx` affiche une barre d'onglets fixe en bas
(h-16, z-40) sur toutes les pages sauf /onboarding, /login, /generating,
/auth. Onglets : Accueil `/`, Repas `/plan`, Recettes `/recettes`,
Listes `/listes`, Diète `/calculateur`, Compte `/compte`.

Conventions de mise en page POUR TOUTES LES PAGES restylées :

- Padding bas minimal du contenu : `pb-28` (la barre couvre ~64px).
- CTA « sticky » : ne PLUS utiliser une barre pleine largeur collée à
  `bottom-0`. Utiliser un bouton flottant AU-DESSUS de la nav :

```tsx
<div className="fixed inset-x-0 bottom-[72px] z-30">
  <div className="mx-auto max-w-md px-5">
    <Link href="…" className={`${buttonClasses("primary", "lg")} w-full shadow-[var(--shadow-lg)]`}>…</Link>
  </div>
</div>
```

- Avec CTA flottant : padding bas du contenu `pb-44`.
- Les liens « retour » en haut de page restent (ChevronLeft), la nav ne
  remplace pas le fil d'ariane.

## 6. Ton rédactionnel

Français, tutoiement, phrases courtes, emojis avec parcimonie (1 par carte max).
Jamais de jargon technique visible.

## 6 bis. Moments du repas (tokens `--slot-*`)

Quatre moments existent : `--slot-petit-dej` (safran), `--slot-dejeuner`
(basilic), `--slot-collation` (menthe, ajouté avec le moment collation) et
`--slot-diner` (violet nuit). Toute nouvelle valeur doit être déclarée dans les
QUATRE blocs de thème de `app/globals.css` (clair, sombre système, `[data-theme]`
sombre et clair), comme les trois autres.

## 7. Garde-fous techniques

- Tokens et `app/globals.css` : propriété de l'orchestrateur, ne pas éditer.
- Pas de nouvelle dépendance npm.
- `npm test` (21 tests) et `npm run lint` doivent rester verts.
- Ne PAS lancer `npm run build` ni de serveur dev (l'orchestrateur s'en charge).
- Accessibilité : cibles tactiles ≥ 44px, `aria-label` sur les boutons icône,
  contrastes AA sur les tokens fournis.
