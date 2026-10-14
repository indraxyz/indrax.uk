# Portfolio source verification

Verified on 2026-10-07 against the linked public repositories’ default branches.
Links below pin the reviewed revisions so the evidence remains reproducible.

Portfolio stacks describe the implementation in the linked repository. Prefer
manifests, schemas, and actual imports or API calls over stale README text or
roadmap items. A dependency declaration alone does not establish feature use;
unused scaffold dependencies and technologies found only in sibling repositories
are excluded. Major versions are shown where
explicitly declared; packages declared as `latest` retain unversioned labels.

The cards and PDF read the same `portfolioItems` data. Update
`features/resume/data/resume.ts` and this record together when a linked repository
or its implementation changes; portfolio pages do not fetch GitHub at runtime.

## kademix

Next.js 16 and React 19; Apollo GraphQL and Prisma with MongoDB. React Router, Vite, and PostgreSQL are not implemented in this revision. The README still describes an older MongoDB integration; database source takes precedence.

Sources: [package.json](https://github.com/indraxyz/fullstack-kademix/blob/39261962a1f3e2d8d8ac090218c970d84f456a68/package.json), [StudentsTable.tsx](https://github.com/indraxyz/fullstack-kademix/blob/39261962a1f3e2d8d8ac090218c970d84f456a68/app/src/features/students/components/student-management/StudentsTable.tsx), [prisma/schema.prisma](https://github.com/indraxyz/fullstack-kademix/blob/39261962a1f3e2d8d8ac090218c970d84f456a68/prisma/schema.prisma), [server/shared/database/prisma.ts](https://github.com/indraxyz/fullstack-kademix/blob/39261962a1f3e2d8d8ac090218c970d84f456a68/server/shared/database/prisma.ts), [app/api/graphql/route.ts](https://github.com/indraxyz/fullstack-kademix/blob/39261962a1f3e2d8d8ac090218c970d84f456a68/app/api/graphql/route.ts).

## Belov

Laravel 8 and Blade with MySQL. React is used in the ticket UI, with Babel in the nested public manifest; Bulma is loaded by the Blade layout.

Sources: [composer.json](https://github.com/indraxyz/belov/blob/aa9a173bd7c1f843c1d7bb475658cf3dbb2d32e4/composer.json), [public/package.json](https://github.com/indraxyz/belov/blob/aa9a173bd7c1f843c1d7bb475658cf3dbb2d32e4/public/package.json), [public/src/tiket.js](https://github.com/indraxyz/belov/blob/aa9a173bd7c1f843c1d7bb475658cf3dbb2d32e4/public/src/tiket.js), [resources/views/admin/layout.blade.php](https://github.com/indraxyz/belov/blob/aa9a173bd7c1f843c1d7bb475658cf3dbb2d32e4/resources/views/admin/layout.blade.php).

## Crimenesia

Laravel 5.4 web application with MySQL, jQuery, Semantic UI, and Noty. The linked repository is the administrator/police web app, so React and React Native are excluded.

Sources: [composer.json](https://github.com/indraxyz/crimenesia_web/blob/e09a7226ad5400dd3279613adee4219c423bacd0/composer.json), [package.json](https://github.com/indraxyz/crimenesia_web/blob/e09a7226ad5400dd3279613adee4219c423bacd0/package.json), [semantic.json](https://github.com/indraxyz/crimenesia_web/blob/e09a7226ad5400dd3279613adee4219c423bacd0/semantic.json), [README.md](https://github.com/indraxyz/crimenesia_web/blob/e09a7226ad5400dd3279613adee4219c423bacd0/README.md).

## WisataApp

Next.js 15, TypeScript, React, Material UI, Emotion, and Tailwind. The page fetches property search, content, and room availability from an external REST API.

Sources: [package.json](https://github.com/indraxyz/WisataApp/blob/cfa18568739a9e530b361d5e87633c1bc812d926/package.json), [app/page.tsx](https://github.com/indraxyz/WisataApp/blob/cfa18568739a9e530b361d5e87633c1bc812d926/app/page.tsx).

## Spektra

JavaScript frontend prototype using Next.js, React, Material UI, Emotion, and Tailwind. The repository describes itself as UI-only; its sample API route does not substantiate a project-management REST backend.

Sources: [package.json](https://github.com/indraxyz/project-monitoring/blob/d09ca5e06814147d75449d067fc0f009c6e3140a/package.json), [README.md](https://github.com/indraxyz/project-monitoring/blob/d09ca5e06814147d75449d067fc0f009c6e3140a/README.md), [pages/dashboard.js](https://github.com/indraxyz/project-monitoring/blob/d09ca5e06814147d75449d067fc0f009c6e3140a/pages/dashboard.js).

## Parkir

Laravel 7 and Blade with MySQL and Tailwind CSS 1. Database configuration defaults to MySQL; other scaffolded connection options do not establish additional databases in use.

Sources: [composer.json](https://github.com/indraxyz/parkir/blob/8ccfc706613b7f6d5b912d4d4bd289d9bc58dc63/composer.json), [package.json](https://github.com/indraxyz/parkir/blob/8ccfc706613b7f6d5b912d4d4bd289d9bc58dc63/package.json), [config/database.php](https://github.com/indraxyz/parkir/blob/8ccfc706613b7f6d5b912d4d4bd289d9bc58dc63/config/database.php).

## TodoApp

Next.js 15, React 18, NextUI 2, TypeScript, and Tailwind CSS 3. The drag-and-drop page imports Motion from motion/react.

Sources: [package.json](https://github.com/indraxyz/todoApp-dragdrop/blob/28aef0d11517717b7c75cd5c5c767b839199c57f/package.json), [app/dnd/page.tsx](https://github.com/indraxyz/todoApp-dragdrop/blob/28aef0d11517717b7c75cd5c5c767b839199c57f/app/dnd/page.tsx), [components/nextUiProvider.tsx](https://github.com/indraxyz/todoApp-dragdrop/blob/28aef0d11517717b7c75cd5c5c767b839199c57f/components/nextUiProvider.tsx).

## Calculator

Confirmed React 19, TypeScript, Vite, Tailwind CSS 4, and React Router 7. The existing card stack already matches.

Sources: [package.json](https://github.com/indraxyz/calculator-reactrouterv7-tailwind-vercel/blob/216e6ec5dd0a6b0a5b86954c3429b30f80232bb7/package.json), [vite.config.ts](https://github.com/indraxyz/calculator-reactrouterv7-tailwind-vercel/blob/216e6ec5dd0a6b0a5b86954c3429b30f80232bb7/vite.config.ts), [src/main.tsx](https://github.com/indraxyz/calculator-reactrouterv7-tailwind-vercel/blob/216e6ec5dd0a6b0a5b86954c3429b30f80232bb7/src/main.tsx).

## Pokedex

Next.js 15 and React 18 with TypeScript, Material UI, Emotion, and Tailwind. Its server API route calls PokéAPI v2.

Sources: [package.json](https://github.com/indraxyz/pokedex/blob/f03c0fc3e732502b7ac02bbb53ae3d1415f60334/package.json), [pages/_app.tsx](https://github.com/indraxyz/pokedex/blob/f03c0fc3e732502b7ac02bbb53ae3d1415f60334/pages/_app.tsx), [pages/api/pokemon/index.ts](https://github.com/indraxyz/pokedex/blob/f03c0fc3e732502b7ac02bbb53ae3d1415f60334/pages/api/pokemon/index.ts).
