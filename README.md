# SmartEat

Application web **Smart Shopping & Meal Planning** : choisir ses repas selon son
régime, son équipement et son budget, puis obtenir une **liste de courses générée
en moins de 3 clics**.

Implémentation du cahier des charges : [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md).

## Démarrer

```bash
npm install
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

Le MVP tourne **sans base de données** : le catalogue (recettes, ingrédients,
magasins) est seedé en mémoire. Aucune variable d'environnement n'est requise.

## Parcours

1. **Onboarding** (`/onboarding`) — capture une seule fois les préférences durables
   (magasin, régime, équipement, foyer), stockées en cookie.
2. **Plan** (`/plan`) — repas pré-générés (warm start) ; ajuster budget/type, swapper
   un repas, puis générer la liste. **≤ 3 clics.** Quatre moments planifiables :
   petit-déjeuner, déjeuner, **collation** (goûter, 14 recettes légères dédiées)
   et dîner — la collation est optionnelle et se choisit à l'onboarding.
3. **Liste** (`/list`) — articles agrégés, groupés par rayon, coût estimé, export.
4. **Diète** (`/calculateur`) — calculateur Diet Legacy : BMR/TDEE en direct puis plan
   calories & macros sur 8-9 semaines (moteur vérifié dans `lib/diet-calculator.ts`,
   100 % client, saisie reprise en localStorage). Le bouton **Générer mes repas**
   envoie la cible de la semaine 1 au plan (`/plan?kcal=…&prot=…`) : les recettes
   sont choisies pour s'en approcher et les **portions ajustées** (×1,4 d'un plat)
   comblent l'écart — la liste de courses suit les mêmes quantités.

## Architecture (le cœur : `lib/`)

| Fichier | Rôle |
|---|---|
| `lib/capabilities.ts` | Mapping **appareil → capacités de cuisson** (substitution Four/Air Fryer gratuite) |
| `lib/matching-engine.ts` | Recipe Matching Engine : passe 1 (filtres durs) + passe 2 (scoring) |
| `lib/diet-calculator.ts` | Calculateur diète (Boer + Katch-McArdle) : BMR/TDEE, 8-9 semaines, macros |
| `lib/nutrition-target.ts` | Pont calories → repas : cible par moment, **facteur de portion**, totaux du jour |
| `lib/shopping-list.ts` | Agrégation / dédoublonnage / groupement par rayon |
| `lib/repo.ts` | **Point de bascule unique** seed → Supabase/Postgres |
| `db/schema.ts` | Schéma Drizzle (cible de production) |
| `db/seed-data.ts` | Catalogue éditorial |

## Tests

```bash
npm test
```

Vérifie le moteur de matching (ex. : un utilisateur qui n'a qu'un Air Fryer
n'obtient jamais de recette nécessitant le Four).

## Déploiement Vercel

Le repo est relié au projet Vercel `smarteat-app` : chaque push déclenche un
déploiement (aperçu pour les branches, production pour `main`). `vercel.json`
fixe la région `fra1`, et le MVP se déploie tel quel (aucune variable
d'environnement requise — mode invité). Le passage à Supabase se fait en
renseignant les variables de `.env.example` dans les réglages du projet ;
checklist complète en §6 du cahier des charges.

## Stack

Next.js 16 (App Router, RSC) · TypeScript · Tailwind v4 · Drizzle ORM ·
Supabase/PostgreSQL (cible) · Zod · lucide-react.
