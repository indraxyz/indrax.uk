import type {
  Achievement,
  Certification,
  Education,
  ExperienceItem,
  Organization,
  PersonalInfo,
  PortfolioItem,
  TechStack,
} from "@/features/resume/types"

export const personalInfo: PersonalInfo = {
  name: "Indra Cahya Edytya",
  title: "Agentic Software Engineer",
  birthDate: "1994-03-22",
  birthPlace: "Surabaya",
  gender: "Male",
  status: "Married",
  address: "Denpasar, Bali, Indonesia",
  phone: "0813 3563 0404",
  email: "indracahyae@gmail.com",
  // Ordered by headline value: the first five are the ones the hero shows on mobile.
  highlightSkills: [
    "Full-stack, APIs & Integrations",
    "AI Automation & Agentic Workflows",
    "Digital Marketing & CRO",
    "System Architecture",
    "Product UI/UX & Design Systems",
    "Cloud Deployment & CI/CD",
    "SQL & NoSQL Databases",
    "Testing, Debugging & Performance",
  ],
}

export const bio = `[9 years] building, maintaining,  improving production apps, websites and digital products.
I partner closely with app, design, marketing and business teams for developments, campaigns and to turn requirements into polished, measurable app/web experiences with strategic approaches.`

export const experiences: ExperienceItem[] = [
  {
    period: "Apr 2026 - Present",
    company: "Juicebox ID/AU, Bali",
    timing: "Full Time, Hybrid",
    role: "Software Engineer",
    description: [
      "Build and maintain production websites and product features across Laravel, Statamic, Shopify, Next.js, and WordPress, with a focus on responsive UX, clean implementation, reliable releases, and fast issue resolution.",
      "Own delivery across MySQL, MariaDB, and PostgreSQL data; Docker, Redis, cloud storage, AWS/VPS CI/CD; Stripe and Xendit payment integrations; unit, feature, and automated testing; and collaboration with Jira, Slack, WhatsApp, Trello, and GitHub.",
      "Use Figma, pen.dev, GSAP, and Lenis for polished digital experiences, and apply AI API integration, n8n workflow automation, and agentic workflows with Claude, Codex, MCP, and skills to improve delivery efficiency and maintains code quality/ conventions.",
      "Projects: Pirate Journey, Capitaliz, Ehrenberg-Bass Institute, XV Premium, MySharePlan, and Kent Removals & Storage.",
      "Website growth and operations: HubSpot forms and automation, n8n integrations across CRM, notifications, and reporting, Google Tag Manager, GA4 event and conversion tracking, Google Search Console, Microsoft Clarity, technical SEO, Core Web Vitals, PageSpeed optimization, Elementor Pro, CRO and A/B testing, security and performance, and hospitality booking, membership, event, and lead-generation funnels.",
    ],
  },
  {
    period: "Apr 2025 - Apr 2026",
    company: "Primuse, Canggu, Bali",
    timing: "Full Time, Hybrid",
    role: "Software Engineer",
    description: [
      "Core team of Kisum App, development from inception, to production with a focus on architecture, scalable systems with best UI/UX and multi-tenant. Key modules developed include Artists, AI (Chat, Prediction), News, Events & Financials, Festivals, Venues, Vendors, and Market.",
      "Projects: Kisum App, plus the Artists, Events, and Venues sites.",
      "Technologies: TypeScript, NextJs, UiUx (Tailwind & Shadcn, Redux/ Zustand/ Context, Tanstack, Mapbox, Swiper, Onborda, Echarts/ Recharts, Figma, Axios, Async, Hooks, React-hook-form, Zod ), GraphQL, WebSocket, REST API, JWT, Jest, docker, github, Turbopack, MongoDB & PostgreSQL, Redis, Aws & Cloudflare, microservices, serverless (Lambda, Cloudflare Workers), express, Crypto, Stripe Payment Gateway, Collaboration (Github Project, Teams, Zoom, Microsoft Cloud), Ai (gemini, n8n)",
    ],
  },
  {
    period: "Jan 2020 - Mar 2025",
    company: "PT Kode Kreatif Digital, Sidoarjo",
    timing: "Full Time, Hybrid",
    role: "Fullstack",
    description: [
      "Develop web apps and hybrid mobile apps (profile, online store, education, health, finance, custom)",
      "Technologies: TypeScript, Material UI, Tailwind, Ant Design, ReactJS, Redux, NextJS, ExpressJS, Laravel, React Native, MySQL, PostgreSQL, ORM, GitHub, GraphQL, REST API, Web Socket, Golang, Python, Docker",
    ],
  },
  {
    period: "Jun 2019 - Dec 2019",
    company: "PT Bank BTPN Tbk, Jakarta",
    timing: "Full Time, Remote",
    role: "Software Engineer",
    description: [
      "Contributed to the Jenius bank app using JavaScript, TypeScript, ReactJS, React Native, Redux, REST API, GraphQL, and database technologies.",
      "Joined through CHIP (Creative Hacknology Intensive Program) by Bank BTPN.",
    ],
  },
  {
    period: "May 2018 - May 2019",
    company: "Yayasan iik Bhakti Wiyata (partner with PT Sigma Intan Mahakarya), Surabaya",
    timing: "Full Time, Hybrid",
    role: "Fullstack",
    description: [
      "Built Ners App, school app, canteen app from scratch",
      "Technologies: JavaScript, TypeScript, Material UI, Tailwind, ReactJS, Redux, NextJS, ExpressJS, Laravel, React Native, MySQL, PostgreSQL, GitHub, GraphQL, REST API, Web Socket",
    ],
  },
  {
    period: "Jun 2016 - Apr 2018",
    company: "CV. Indscript Computer, Sidoarjo",
    timing: "Full Time, Onsite",
    role: "Fullstack",
    description: [
      "Developed web/android applications based on client requirements such as Company profiles, online stores, parking systems, waiting systems, POS, custom solutions",
      "Technologies: Laravel, ExpressJS, ReactJS, Material UI, React Native, MySQL, ORM, GitHub, REST API",
    ],
  },
  {
    period: "Mar 2016 - May 2016",
    company: "CV. Mitra Mia Group, Surabaya",
    timing: "Freelance, Hybrid",
    role: "Full-stack, Team Lead (7 members)",
    description: [
      "Built online shop web for property listings",
      "Technologies: Laravel, jQuery, Bootstrap, MySQL, JSON, GitHub, REST API, VPS Server",
    ],
  },
  {
    period: "Aug 2012 - Feb 2013",
    company: "LPK Mitra Computer, Sidoarjo",
    timing: "Full Time, Onsite",
    role: "Technician, Professional Computer Trainer",
    description: ["Microsoft Office, Graphic Design, Technician, Networking"],
  },
]

// Ordered by project value: production systems with real business domains and
// fullstack ownership first, then the smaller showcase builds.
export const portfolioItems: PortfolioItem[] = [
  {
    title: "kademix",
    description:
      "data table management with proper uiux & performance with Next.js, React Router,  MongoDB, Postgresql, GraphQL, React, TypeScript, Vite/ Turbopack, Tailwind CSS v4 (fullstack application) enhanced for optimal maintainability and scalability.",
    year: "2025",
  },
  {
    title: "Belov",
    description:
      "Correction data system. Main features: manage ticket (detail, attachments, verification, history, delete). Web base using Laravel, MySQL, ReactJS, BulmaCSS",
    year: "2022",
  },
  {
    title: "Crimenesia",
    description:
      "Crime reporting system between police and society. Main features: crime reporting and crime mapping. Web and android platform using Laravel, MySQL, jQuery, Semantic, NotyJS, ReactJS, React Native",
    year: "2017",
  },
  {
    title: "WisataApp",
    description:
      "Booking rooms platform. Main features: search property, hotels, available rooms. Web base with TypeScript, NextJS, Tailwind, MaterialUI, REST API",
    year: "2024",
  },
  {
    title: "Spektra",
    description:
      "Project monitoring system. Main features: monitoring progress, register and approvals projects. Web base with NextJS, Tailwind, MaterialUI, EmotionJS, REST API",
    year: "2023",
  },
  {
    title: "Parkir",
    description:
      "Parking management system. Main features: auto select location, park entrance and out, tariff and payment, report. Web base using Laravel, Tailwind, MySQL",
    year: "2021",
  },
  {
    title: "TodoApp",
    description:
      "todoApp (kanban board) q with drag drop functionality use Typescript, NextJs, NextUi, tailwind, motion.",
    year: "2025",
  },
  {
    title: "Calculator",
    description:
      "beautiful, secure that built with React 19, TypeScript, Vite, Tailwind CSS v4, and React Router v7. This calculator combines modern design with robust security measures, excellent user experience, optimized code architecture.",
    year: "2025",
  },
  {
    title: "Pokedex",
    description:
      "search about pokemons that built with typescript, nextJs, material ui, tailwind, pokemon api v2.",
    year: "2025",
  },
]

export const techSkills = [
  "Architect and evolve scalable, maintainable software systems from requirements through production",
  "Apply clean code, strong design principles, structured problem-solving, and pragmatic engineering judgment",
  "Deliver full-stack app/web products with consistent ownership across frontend, backend, data, integrations, and release quality",
  "Translate business goals and user needs into clear technical solutions, priorities, and implementation plans",
  "Design reliable APIs, service boundaries, authentication flows, data models, and third-party integrations",
  "Protect applications through security-aware design, access control, validation, dependency hygiene, and operational discipline",
  "Own website and CMS lifecycles, including content accuracy, landing pages, staging, publishing, maintenance, and continuous improvement",
  "Create responsive, accessible, user-centered experiences that meet product, brand, and cross-device quality standards",
  "Improve performance through measurement, bottleneck analysis, Core Web Vitals, page-speed work, and focused iteration",
  "Build quality into delivery with test strategy, regression prevention, debugging, release validation, and production support",
  "Operate dependable delivery workflows across environments, deployments, monitoring, backups, incident response, and rollback planning",
  "Implement measurable technical SEO, analytics, event tracking, and user-journey instrumentation for informed decisions",
  "Connect CRM, marketing automation, lead capture, notification, booking, payment, membership, and event-registration journeys",
  "Improve conversion through funnel analysis, experimentation, A/B testing, landing-page refinement, and user feedback",
  "Collaborate effectively with marketing, design, product, operations, vendors, and engineering teams",
  "Lead project execution through planning, documentation, progress communication, risk management, and continuous improvement",
  "Use AI-agentic development and workflow automation responsibly, with human review for correctness, security, and maintainability",
  "Adapt quickly to new technologies and business contexts while preserving clear standards and dependable delivery",
] as const

export const techStacks: TechStack[] = [
  {
    group: "Languages & Web Foundations",
    category: "Languages",
    items: "TypeScript, JavaScript, Dart, PHP, Go, Python, SQL, HTML, CSS",
  },
  {
    group: "Languages & Web Foundations",
    category: "Web Standards",
    items:
      "Responsive web development, accessibility, semantic HTML, modern CSS, browser APIs, JSON, web performance fundamentals",
  },
  {
    group: "Frontend Engineering",
    category: "Frameworks & Rendering",
    items:
      "React, Next.js, Remix, React Router, Preact, Server-side rendering, static generation, server components",
  },
  {
    group: "Frontend Engineering",
    category: "UI, Styling & Design Systems",
    items:
      "Tailwind CSS, Material UI, Ant Design, Bootstrap, Bulma, Emotion, Styled JSX, UnoCSS, Shadcn, Radix, Base UI, HeroUI, Fluent UI, Mantine, Chakra UI, Gluestack, Tamagui",
  },
  {
    group: "Frontend Engineering",
    category: "State, Data & Forms",
    items:
      "Redux, Zustand, Context, TanStack Query, Axios, Fetch, React Hook Form, Zod, Urql, Lodash, RxJS, async utilities, React Hooks, loadable-components",
  },
  {
    group: "Frontend Engineering",
    category: "Motion, Visualization & Components",
    items:
      "GSAP, Framer Motion, Remotion, Lenis, ECharts, Recharts, Nivo, TanStack Table, Swiper, Embla Carousel, Onborda, React Flow, Mapbox",
  },
  {
    group: "Backend & API Engineering",
    category: "Frameworks & Runtime",
    items: "Laravel, Express, Fastify, Hono.js, GoFiber, Gin, Node.js, serverless functions",
  },
  {
    group: "Backend & API Engineering",
    category: "APIs & Communication",
    items:
      "REST, GraphQL, WebSocket, RPC, JSON-RPC, webhooks, async workflows, API documentation with Swagger & Larecipe",
  },
  {
    group: "Data & Storage",
    category: "Databases",
    items:
      "PostgreSQL, MySQL, MariaDB, MongoDB, Supabase, Firebase, Neon, SQL and NoSQL data modeling",
  },
  {
    group: "Data & Storage",
    category: "ORM, Cache & Storage",
    items:
      "Prisma, Drizzle, ORM patterns, Redis, object storage, cloud storage, serverless storage, query optimization",
  },
  {
    group: "Architecture & Security",
    category: "Architecture Patterns",
    items:
      "Monolith, modular monolith, microservices, service-oriented, event-driven, serverless, monorepo, microkernel",
  },
  {
    group: "Architecture & Security",
    category: "Authentication & Application Security",
    items:
      "JWT, Auth.js, Better Auth, access control, input validation, secure API design, cryptography fundamentals",
  },
  {
    group: "Architecture & Security",
    category: "Engineering Practices",
    items:
      "Clean architecture, design patterns, OOP, functional programming, Agile, Scrum, iterative delivery, code review, documentation, decision records, architecture notes, security awareness, dependency management, threat modeling, observability, logging, monitoring, alerting, incident response, rollback planning",
  },
  {
    group: "Website Operations",
    category: "CMS & Website Platforms",
    items:
      "Shopify, WordPress, Elementor Pro, PHP, Statamic, Next.js, Laravel, landing pages, content publishing",
  },
  {
    group: "Website Operations",
    category: "Performance, SEO & Accessibility",
    items:
      "Core Web Vitals, PageSpeed Insights, technical SEO, responsive optimization, accessibility, metadata, structured content",
  },
  {
    group: "Website Operations",
    category: "Security & Site Reliability",
    items:
      "Platform security, plugin management, updates, backups, monitoring, staging/live environments, DNS, SSL",
  },
  {
    group: "Cloud & Delivery",
    category: "Cloud & Hosting",
    items: "AWS, Cloudflare, Vercel, VPS, AWS Lambda, Cloudflare Workers, Vercel Functions",
  },
  {
    group: "Cloud & Delivery",
    category: "Containers, CI/CD & Build",
    items: "Docker, GitHub workflows, CI/CD, Webpack, Turbopack, Vite, Turborepo, VPS deployment",
  },
  {
    group: "Quality & Observability",
    category: "Testing",
    items:
      "Pest, Jest, Vitest, Testify, unit testing, integration testing, feature testing, regression testing, automated browser testing, JSON Server, data mocking",
  },
  {
    group: "Quality & Observability",
    category: "Debugging & Performance",
    items:
      "Browser DevTools, React Profiler, log tracing, bottleneck analysis, performance tuning, release validation",
  },
  {
    group: "Quality & Observability",
    category: "Backend Code Quality & Security",
    items:
      "Code review, consistent naming and project conventions, formatting, linting, type safety, input validation, secure API design, dependency updates, threat-aware implementation, API documentation, architecture notes, and decision records",
  },
  {
    group: "Quality & Observability",
    category: "Frontend Code Quality & Documentation",
    items:
      "Component conventions, reusable UI patterns, accessibility, responsive quality, secure client-side practices, README guides, Storybook documentation",
  },
  {
    group: "Integrations & Growth",
    category: "CRM, Analytics & Automation",
    items:
      "HubSpot forms, workflows, reporting, GA4, Google Tag Manager, Google Search Console, Microsoft Clarity, Meta Pixel",
  },
  {
    group: "Integrations & Growth",
    category: "Funnels, Payments & Conversion",
    items:
      "Stripe, Xendit, Midtrans, Polar, lead capture, booking flows, membership journeys, event registration, CRO, A/B testing",
  },
  {
    group: "Integrations & Growth",
    category: "Digital Advertising & Performance Marketing",
    items:
      "Google Ads (Search, Performance Max, Display, YouTube, Shopping), Meta Ads Manager, TikTok Ads, LinkedIn Ads, campaign structure & budget pacing, keyword research & negative keywords, audience segmentation, lookalike and retargeting audiences, ad copy and creative testing, landing page & offer alignment, Google Merchant Center and product feeds, server-side tagging, Conversions API, offline conversion import, attribution modelling, UTM taxonomy, ROAS, CPA and LTV analysis, bid strategies & budget allocation, Looker Studio reporting, email marketing and lifecycle automation, remarketing funnels",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "Flutter Language & Core",
    items:
      "Flutter, Flutter SDK, Dart, sound null safety, strong typing, Futures & async/await, Streams & StreamController, isolates & compute, generics, mixins, extension methods, sealed classes & pattern matching, records, error handling, lifecycle & memory management",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "Flutter UI & Rendering",
    items:
      "Widget/Element/RenderObject tree, Material 3, Cupertino, slivers & CustomScrollView, custom painters & render objects, LayoutBuilder, responsive and adaptive layouts, theming & design tokens, implicit and explicit animations, AnimationController, Hero transitions, Rive, Lottie, fragment shaders, intl localization, accessibility semantics",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "Flutter State Management",
    items:
      "Riverpod, Bloc/Cubit, Provider, GetX, MobX, InheritedWidget, ChangeNotifier & ValueNotifier, signals, immutable state with freezed, state restoration, dependency scoping",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "Flutter Architecture & Code Generation",
    items:
      "Clean architecture, MVVM, feature-first modularization, repository pattern, get_it & injectable DI, go_router & Navigator 2.0, deep links, build_runner, freezed, json_serializable, Pigeon, Melos monorepos, build flavors & environment config",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "Flutter Data & Networking",
    items:
      "Dio, Retrofit, http, REST, GraphQL, WebSocket, gRPC, interceptors, retries & auth refresh, Hive, Isar, Drift, sqflite, shared_preferences, flutter_secure_storage, offline-first sync, caching & pagination",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "Flutter Platform & Native Integration",
    items:
      "Platform channels, Pigeon, Dart FFI, Kotlin & Swift interop, Firebase (Auth, Firestore, Messaging, Crashlytics, Remote Config, Analytics), push notifications, in-app purchase, maps, camera, permissions, biometrics, background tasks, WebView",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "Flutter Testing & Performance",
    items:
      "Unit, widget, golden, and integration_test suites, mocktail & mockito, patrol, DevTools, timeline & memory profiling, jank and rebuild analysis, const & RepaintBoundary tuning, deferred loading, app size reduction",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "Flutter Build & Release",
    items:
      "Fastlane, Codemagic, GitHub Actions, code signing, build flavors, Play Store & App Store release, staged rollouts, Firebase App Distribution, TestFlight, Crashlytics monitoring, web & desktop targets",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "React Native Core & Runtime",
    items:
      "React Native, New Architecture (Fabric, TurboModules, JSI), Hermes, bridgeless mode, Expo & EAS, bare workflow, Metro bundler, monorepo setup, React 19 concurrent features, OTA updates with EAS Update",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "React Native UI & Interaction",
    items:
      "Flexbox layout, StyleSheet, NativeWind, Reanimated, Gesture Handler, Skia, Lottie, FlashList & FlatList virtualization, SafeArea, responsive and adaptive layouts, dark mode theming, accessibility props, i18n",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "React Native Navigation & State",
    items:
      "React Navigation, Expo Router, deep links & universal links, Redux Toolkit, Zustand, Jotai, MobX, Context, TanStack Query, RTK Query, React Hook Form, Zod",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "React Native Data & Storage",
    items:
      "REST, GraphQL with Apollo & urql, WebSocket, Axios, MMKV, AsyncStorage, WatermelonDB, Realm, SQLite, Keychain & Keystore secure storage, offline-first sync, caching & pagination",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "React Native Modules & Device",
    items:
      "TurboModules & legacy native modules, Kotlin/Java and Swift/Objective-C interop, Expo config plugins, Firebase (Auth, Firestore, Messaging, Crashlytics, Remote Config, Analytics), push notifications, in-app purchase, Mapbox & Google Maps, camera, permissions, biometrics, background tasks, WebView",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "React Native Testing & Performance",
    items:
      "Jest, React Native Testing Library, Detox, Maestro, MSW, React DevTools & Flipper, Hermes profiling, re-render analysis, list performance, startup time & bundle size, memory leak tracing",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "React Native Build & Release",
    items:
      "EAS Build & Submit, Fastlane, GitHub Actions, Bitrise, code signing & provisioning, build flavors & schemes, Play Store & App Store release, staged rollouts, OTA updates, Sentry & Crashlytics monitoring",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "Rich Interfaces",
    items: "Tiptap, Plate, Quill, React Flow, Algolia, Alpine.js, jQuery, NotyJS, RxJS, Lodash",
  },
  {
    group: "AI & Automation",
    category: "AI Platforms & Models",
    items:
      "OpenAI, Claude, Gemini, Llama, AI APIs, prompt design, evaluation, and human-in-the-loop review",
  },
  {
    group: "AI & Automation",
    category: "Agentic Workflows",
    items:
      "Claude Code, Codex, Cursor/ VS Code/ ZED IDE, agentic CLIs & agents, MCP clients & servers, tool and function design, skills, subagents & multi-agent orchestration, structured plans and task decomposition, context engineering, repository rules & conventions files, hooks and permission policies, sandboxed execution, git worktree isolation, spec-driven and test-driven agentic loops, review & refactor agents, codebase retrieval, prompt and workflow versioning, evaluation harnesses & regression suites, guardrails, human-in-the-loop approval, token & cost budgeting, observability and audit trails, agents in CI/CD",
  },
  {
    group: "AI & Automation",
    category: "n8n Core & Workflow Design",
    items:
      "n8n, workflow design & orchestration, Webhook, Schedule, Polling, Form and Chat triggers, Execute Workflow & sub-workflows, Merge, Loop Over Items, Split In Batches, IF, Switch, Filter, Wait, Stop and Error, error workflows, retries & continue-on-fail, pinned data, tags, folders, templates, workflow versioning",
  },
  {
    group: "AI & Automation",
    category: "n8n Nodes & Integrations",
    items:
      "HTTP Request, Webhook & Respond to Webhook, REST & GraphQL APIs, pagination, rate limiting & backoff, Google Workspace (Sheets, Drive, Gmail, Calendar), Slack, Notion, Airtable, HubSpot, Stripe, Telegram, WhatsApp, Discord, GitHub, Jira, Postgres, MySQL, MongoDB, Redis, S3, SFTP, RSS, community nodes, custom node development",
  },
  {
    group: "AI & Automation",
    category: "n8n AI & LLM Automation",
    items:
      "AI Agent and Chat Trigger nodes, basic and conversational LLM chains, OpenAI, Claude, Gemini and Ollama model nodes, tool calling, MCP client & server nodes, vector stores (Pinecone, Qdrant, Supabase, PGVector), embeddings, RAG pipelines, document loaders & text splitters, buffer/Postgres/Redis memory, structured output parsers, evaluation and human-in-the-loop approval",
  },
  {
    group: "AI & Automation",
    category: "n8n Data & Logic",
    items:
      "Code node in JavaScript and Python, n8n expressions, JMESPath, Edit Fields, Item Lists, Aggregate, Sort, Remove Duplicates, Date & Time, Crypto, JSON, XML, HTML and CSV parsing, binary and file handling, data mapping & schema shaping, idempotency keys, deduplication",
  },
  {
    group: "AI & Automation",
    category: "n8n Security & Credentials",
    items:
      "Credential management, OAuth2 and API key auth, JWT, HMAC webhook signature verification, header auth, environment variables & external secrets, RBAC and project permissions, SSO, audit logs, data redaction, retention policies",
  },
  {
    group: "AI & Automation",
    category: "n8n Deployment & Operations",
    items:
      "Self-hosted n8n on Docker and Docker Compose, n8n Cloud, queue mode with Redis and workers, Postgres persistence, horizontal scaling & concurrency tuning, separated webhook and worker processes, Nginx & Traefik reverse proxy, staging environments, Git-based source control, CI/CD, execution logging & pruning, monitoring, alerting, backup & restore",
  },
  {
    group: "Design & Product Experience",
    category: "Product Design & UX",
    items:
      "Figma, pen.dev, Adobe XD, Eraser, Photoshop, Illustrator, CorelDRAW, Lightroom, design systems, UX review, user flows, visual QA",
  },
  {
    group: "Project Management & Collaboration",
    category: "Development & Documentation",
    items:
      "Git, GitHub, VS Code, Storybook, Swagger, Larecipe, technical documentation, decision records",
  },
  {
    group: "Project Management & Collaboration",
    category: "Project Management",
    items:
      "Jira, Microsoft Planner, GitHub Projects, Trello, Notion, Agile planning, sprint coordination, progress tracking, risk management",
  },
  {
    group: "Project Management & Collaboration",
    category: "Communication & Stakeholders",
    items:
      "Slack, Microsoft Teams, WhatsApp, Google Meet, Zoom, Microsoft 365, Microsoft Cloud, Google Workspace, cross-functional communication, vendor coordination",
  },
]

export const education: Education[] = [
  {
    degree: "Bachelor Degree (S1)",
    field: "Informatics Engineering",
    institution: "(UNTAG) Universitas 17 Agustus 1945 Surabaya",
    period: "Aug 2013 - Feb 2018",
    gpa: "3.66",
    thesis:
      "Developed an application (web & Android) called Crimenesia for facilitating crime reporting and communication between police and the community.",
    organization: [
      "Pencak Silat Merpati Putih",
      "HIMA Informatika UNTAG",
      "CTComp (Tech Community)",
    ],
    description:
      "Graduated with honors with a GPA of 3.66. Multiple tech community activities, participated in student organizations, and completed a thesis project developing a crime reporting application (Crimenesia) in collaboration with local police and the community.",
  },
  {
    degree: "High School",
    field: "Natural Sciences Major",
    institution: "SMAN 1 Gedangan, Sidoarjo",
    period: "2009 - 2012",
    organization: ["DANS Sidoarjo (Duta Anti Narkoba Sidoarjo)"],
    description:
      "Graduated with a strong foundation in natural sciences, participated in student activities, and played an active role in anti-drug prevention initiatives with the Duta Anti Narkoba Sidoarjo (DANS) organization as Vice Chairman.",
  },
]

export const certifications: Certification[] = [
  {
    title: "Claude Code in Actions",
    issuer: "Anthropic",
    period: "May 2026",
    link: "https://verify.skilljar.com/c/mwaaehb59bxc",
    group: "Claude by Anthropic",
  },
  {
    title: "Fundamentals",
    issuer: "Anthropic",
    group: "Claude by Anthropic",
  },
  {
    title: "AI Fluency",
    issuer: "Anthropic",
    group: "Claude by Anthropic",
  },
  {
    title: "MCP",
    issuer: "Anthropic",
    group: "Claude by Anthropic",
  },
  {
    title: "Claude API",
    issuer: "Anthropic",
    group: "Claude by Anthropic",
  },
  {
    title: "AI Capabilities & Limitations",
    issuer: "Anthropic",
    group: "Claude by Anthropic",
  },
  {
    title: "Claude Cowork",
    issuer: "Anthropic",
    group: "Claude by Anthropic",
  },
  {
    title: "Skills",
    issuer: "Anthropic",
    group: "Claude by Anthropic",
  },
  {
    title: "Subagents",
    issuer: "Anthropic",
    group: "Claude by Anthropic",
  },
  {
    title: "Agents and Workflows",
    issuer: "OpenAI",
    group: "ChatGPT/Codex by OpenAI",
  },
  {
    title: "AI Foundations and Applied",
    issuer: "OpenAI",
    group: "ChatGPT/Codex by OpenAI",
  },
  {
    title: "N8n Integrations & Automations",
    issuer: "MySkill",
    period: "Jun 2026",
    link: "https://www.linkedin.com/safety/go/?url=https%3A%2F%2Fstorage.googleapis.com%2Fmyskill-v2-certificates%2Fcourse-OZLZZJOr9qUzEB0JLbDk%2FrnHNapLUn7RYMFGW0JWkQBBpTTa2-M8zTyO8pby9zYg0uuqhc.pdf&urlhash=u3TY&mt=_icNjnn8-94jHaJN35EiGKqVsFuarQ6zqnhg-kViy-sApL4BbpNgO43l_Iall3ikF2CZlrdlGZMJ-sK2T7GaAm4B3UY&isSdui=true&lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base_certifications_details%3BpVejrEsuST2iAdxnRoy4mA%3D%3D",
    group: "AI Automations by MySkill",
  },
  {
    title: "Chatbot",
    issuer: "MySkill",
    group: "AI Automations by MySkill",
  },
  {
    title: "Social Media",
    issuer: "MySkill",
    group: "AI Automations by MySkill",
  },
  {
    title: "Resume",
    issuer: "MySkill",
    group: "AI Automations by MySkill",
  },
  {
    title: "Prediction",
    issuer: "MySkill",
    group: "AI Automations by MySkill",
  },
  {
    title: "Problem Solving",
    issuer: "HackerRank",
    period: "Dec 2024",
    link: "https://www.hackerrank.com/certificates/a42dc6068da4",
  },
  {
    title: "Information system audit",
    issuer: "BNSP Certification",
    period: "Mar 2018 - Mar 2021",
  },
  {
    title: "Website application security training",
    issuer: "ISTTS Institut Sains Terapan & Teknologi Surabaya",
    period: "Apr 2019",
  },
  {
    title: "Building iOT Application with Microcontroller, sensors, web server, mqtt cloud",
    issuer: "INIXINDO",
    period: "Oct 2019",
  },
]

export const achievements: Achievement[] = [
  {
    title: "1st Champion of DANS 2010",
    description: "Duta Anti Narkoba Sidoarjo (DANS) BNNK Sidoarjo",
    period: "2010",
  },
  {
    title: "8th Best Graduate",
    description: "SMPN 3 Waru (Junior High School)",
    period: "2009",
  },
  {
    title: "Consistently Ranked 1st in Class",
    description: "Elementary School, from 1st through 6th grade",
    period: "2000 - 2006",
  },
]

export const organizations: Organization[] = [
  {
    title: "Vice Chairman of DANS Sidoarjo",
    period: "2010 - 2012",
    description: "Duta Anti Narkoba Sidoarjo (DANS) BNNK Sidoarjo",
  },
  {
    title: "Member of Pencak Silat Merpati Putih",
    period: "2013 - 2015",
    description: "Universitas 17 Agustus 1945 Surabaya",
  },
]
