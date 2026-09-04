# Architecture Overview

This document describes the architecture and design decisions for the Resume/CV website.

## 📐 Project Structure

```
├── app/                      # Next.js App Router
│   ├── layout.tsx           # Root layout, metadata, and the theme bootstrap
│   ├── page.tsx             # Server entry for the resume page
│   ├── robots.ts            # Generated /robots.txt
│   ├── sitemap.ts           # Generated /sitemap.xml
│   └── globals.css          # Global styles with Tailwind v4
│
├── components/              # Shared UI primitives
│   ├── theme-toggle.tsx     # Light / dark / system switcher
│   └── ui/                  # shadcn/ui base components
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── drawer.tsx
│       ├── popover.tsx
│       ├── section-card.tsx # Card + header composition used by every section
│       ├── section-header.tsx
│       ├── separator.tsx
│       ├── timeline.tsx
│       └── variants.ts      # Visual variant tokens
│
├── features/
│   └── resume/
│       ├── components/      # Feature UI, section cards, and drawer
│       ├── data/            # Resume source content
│       ├── utils/           # Feature-specific derived helpers
│       ├── config.ts        # Resume config and links
│       └── types.ts         # Resume domain types
│
├── lib/                     # Shared, framework-level helpers
│   ├── theme.ts            # Theme storage key, event, and default
│   └── utils/
│       ├── cn.ts           # Class name utility (clsx + tailwind-merge)
│       ├── date.ts         # Date formatting utilities
│       └── index.ts        # Barrel export
│
└── public/                  # Static assets
    └── foto-profile.jpg    # Profile image
```

## 🏗️ Architecture Principles

### 1. **Separation of Concerns**

- **Feature ownership**: Resume code lives together under `features/resume/`
- **Data**: Resume source data is separated into `features/resume/data/resume.ts`
- **Types**: Resume domain types live in `features/resume/types.ts`
- **Components**: UI components are separated from business logic
- **Utilities**: Shared utilities stay in `lib/utils/`, while resume-specific derivations live in `features/resume/utils/`

### 2. **Type Safety**

- Full TypeScript implementation
- All data structures are typed
- Component props are strictly typed
- No `any` types used

### 3. **Component Reusability**

- Shared UI primitives in `components/ui/`
- Resume-specific components in `features/resume/components/`
- Base UI components from shadcn/ui
- Consistent component patterns

### 4. **Maintainability**

- Feature-based folder structure
- Smaller focused components for sidebar cards and sections
- Derived values are computed from source data instead of duplicated
- Single source of truth for data

### 5. **Developer Experience**

- TypeScript for autocomplete and type checking
- ESLint for code quality
- Prettier for code formatting
- Clear naming conventions
- Comprehensive README

## 🔄 Data Flow

```
features/resume/data/resume.ts (Source of Truth)
    ↓
features/resume/types.ts (Type Definitions)
    ↓
features/resume/components/resume-page.tsx (Presentation Layer)
    ↓
features/resume/components/ (Feature Components)
    ↓
components/ui/ (Base UI Components)
```

## 📦 Key Design Decisions

### Why This Structure?

1. **Scalability**: Easy to add new sections or features
2. **Maintainability**: Clear separation makes updates easy
3. **Testability**: Components and utilities can be tested independently
4. **Reusability**: Components can be reused across the application
5. **Type Safety**: TypeScript catches errors at compile time

### Component Organization

- **Scrolling panes are regions**: any pane that scrolls — a height-capped card
  body or a horizontal rail — is focusable and carries an `aria-label`, so keyboard
  users can reach content that is off-screen
- **Print carries everything**: the sidebar lives in a drawer that unmounts while
  closed, so `resume-page.tsx` renders a print-only copy and `globals.css` drops the
  portalled drawer from the printed sheet
- **Server-rendered assets resolve from disk**: react-pdf and Satori both pick how to
  load a font or image from the shape of its `src` - a URL is fetched, anything else
  is opened as a filesystem path. Browser-style paths such as `/fonts/x.ttf` fail
  silently on the server, so `features/resume/pdf/theme.ts` and
  `features/resume/social-card.tsx` resolve every asset against `process.cwd()`
- **One PDF render path**: the document is drawn by `app/api/resume-pdf` at build
  time and served as a static file. The footer control is a plain link, so the
  renderer never reaches the browser bundle and the download survives without JS
- **Section composition**: Every section — the six drawer cards and the three main
  sections — renders through `components/ui/section-card.tsx`, which owns the card
  frame, the header bar, and the `card` / `ghost` variants
- **UI Components** (`components/ui/`): Base design system components
- **Resume Feature** (`features/resume/`): Domain-specific data, types, config, and components
- **Page Components** (`app/`): Thin route entry points

### Data Management

- Resume data stays in one feature-owned file for easy updates
- Data is typed for safety
- Derived values such as age are computed from raw data

## 🛠️ Development Workflow

1. **Update Data**: Edit `features/resume/data/resume.ts`
2. **Add Types**: Update `features/resume/types.ts` if needed
3. **Create Components**: Add feature components under `features/resume/components/` or shared primitives under `components/ui/`
4. **Use in Pages**: Compose feature entry points from `app/page.tsx`

## 📝 Code Style

- **TypeScript**: Strict mode enabled
- **Naming**: PascalCase for components, camelCase for functions
- **Imports**: Absolute imports using `@/` alias
- **Formatting**: Prettier with consistent config
- **Linting**: ESLint with Next.js config

## 🚀 Future Improvements

Potential enhancements:

- [x] Add E2E tests with Playwright
- [x] Add PDF generation API route - `/resume.pdf`
- [x] Add analytics - PostHog, key-gated
- [x] Surface contact details in the hero (email, LinkedIn, GitHub)
- [ ] Add unit tests with Vitest
- [ ] Add Storybook for component documentation
- [ ] Add i18n support for multiple languages
- [ ] Enforce import ordering with an ESLint rule
- [ ] Cookie-consent gate before analytics runs for UK/EU visitors
