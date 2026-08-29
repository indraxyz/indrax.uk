# Indra Cahya Edytya - Resume/CV Website

A modern, responsive resume/curriculum vitae website built with Next.js 16, TypeScript, Tailwind CSS v4, and shadcn/ui components.

## 🚀 Features

- **Modern UI/UX**: Clean, professional design with shadcn/ui components
- **Fully Typed**: Complete TypeScript implementation
- **Responsive**: Mobile-first design that works on all devices
- **Print-Friendly**: Prints the complete resume, sidebar included, for PDF export
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
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout and metadata
│   ├── page.tsx           # Server route entry
│   ├── robots.ts          # Generated /robots.txt
│   ├── sitemap.ts         # Generated /sitemap.xml
│   └── globals.css        # Global styles
├── components/            # Shared UI primitives
│   └── ui/               # shadcn/ui components
├── features/
│   └── resume/
│       ├── components/   # Resume feature components
│       ├── data/         # Resume data
│       ├── utils/        # Resume-specific helpers
│       ├── config.ts     # Resume config
│       └── types.ts      # Resume types
└── lib/                   # Utility functions
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
