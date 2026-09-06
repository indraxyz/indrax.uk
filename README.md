# Indra Cahya Edytya - Resume/CV Website

A modern, responsive resume/curriculum vitae website built with Next.js 16, TypeScript, Tailwind CSS v4, and shadcn/ui components.

## 🚀 Features

- **Modern UI/UX**: Clean, professional design with shadcn/ui components
- **Fully Typed**: Complete TypeScript implementation
- **Responsive**: Mobile-first design that works on all devices
- **Print-Friendly**: Prints the complete resume, sidebar included, for PDF export
- **Downloadable CV**: react-pdf draws the resume in the browser on request, lazily loaded
- **Designed Social Card**: 1200x630 Open Graph banner generated from the resume data
- **Structured Data**: `ProfilePage` / `Person` JSON-LD linking the GitHub and LinkedIn profiles
- **Measured**: optional PostHog analytics for pageviews, CV downloads, and contact clicks
- **Performance**: Built with Next.js 16 and optimized for speed
- **Accessible**: Landmarked page, keyboard-reachable scroll regions, labelled controls

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Package Manager**: npm

## 📁 Project Structure

```
├── app/                       # Next.js app directory
│   ├── layout.tsx            # Root layout and metadata
│   ├── page.tsx              # Server route entry, emits the JSON-LD block
│   ├── opengraph-image.tsx   # Next convention; serves the social card
│   ├── robots.ts             # Generated /robots.txt
│   ├── sitemap.ts            # Generated /sitemap.xml
│   └── globals.css           # Global styles
├── components/               # Shared UI primitives
│   ├── posthog-analytics.tsx # Starts the tracker; renders nothing
│   ├── theme-toggle.tsx     # Light / dark / system switcher
│   └── ui/                  # shadcn/ui components
├── e2e/                      # Playwright end-to-end specs
├── features/
│   └── resume/
│       ├── components/      # Resume feature components
│       ├── data/            # Resume data
│       ├── pdf/             # PDF document and theme
│       ├── utils/           # Resume-specific helpers
│       ├── config.ts        # Resume config
│       ├── social-card.tsx  # Link-preview banner composition
│       └── types.ts         # Resume types
├── docs/                     # Feature specs
└── lib/                      # Utility functions
    ├── analytics.ts         # PostHog init and event capture
    └── utils/
```

## 🏃 Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd indrax-nextjs-shadcn-vercel
```

2. Install dependencies

```bash
npm install
```

3. Run the development server

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment

Every variable is optional; copy `.env.example` to `.env.local` to set them.

| Variable                   | Default                    | Purpose                                                         |
| :------------------------- | :------------------------- | :-------------------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`  | unset                      | PostHog project key. Unset means analytics never initialises.   |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` | Ingestion host.                                                 |
| `NEXT_PUBLIC_SITE_URL`     | `https://indrax.uk`        | Origin advertised in metadata, the sitemap and the social card. |

### Testing

```bash
npx playwright install chromium   # once
npm run test:e2e
```

The suite builds the site and runs against `next start`, because the CV and the
social card are prerendered at build time and behave differently under `next dev`.

## 📜 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run type-check` - Run TypeScript type checking
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run clean` - Clean build artifacts
- `npm run check` - Format check, lint and type-check in one pass
- `npm run test:e2e` - Run the Playwright suite against a production build
- `npm run test:e2e:ui` - The same suite in Playwright's UI mode

## 🎨 Customization

### Update Resume Data

Edit `features/resume/data/resume.ts` to update your personal information, experiences, portfolio, etc.

### Styling

- Global styles: `app/globals.css`
- Theme colors: Update CSS variables in `@theme` block
- Component styles: Use Tailwind classes or modify component files

### Components

- UI components: `components/ui/`
- Resume feature components: `features/resume/components/`

## 📦 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com)
3. Deploy!

### Other Platforms

Build the project:

```bash
npm run build
```

The output will be in the `.next` directory.

## 📝 License

Private project - All rights reserved

## 👤 Author

**Indra Cahya Edytya**

- Email: indracahyae@gmail.com
- GitHub: [@indraxyz](https://github.com/indraxyz)

---

Made with ❤️ using Next.js and TypeScript
