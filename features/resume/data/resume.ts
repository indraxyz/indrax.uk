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
      "Build and maintain production websites and product features across Laravel, Statamic, Shopify, Next.js, Vue.js, and WordPress, with a focus on responsive UX, clean implementation, reliable releases, and fast issue resolution.",
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
      "Technologies: TypeScript, NextJs, Vue.js, UiUx (Tailwind & Shadcn, Redux/ Zustand/ Context, Tanstack, Mapbox, Swiper, Onborda, Echarts/ Recharts, Figma, Axios, Async, Hooks, React-hook-form, Zod ), GraphQL, WebSocket, REST API, JWT, Jest, docker, github, Turbopack, MongoDB & PostgreSQL, Redis, Aws & Cloudflare, microservices, serverless (Lambda, Cloudflare Workers), express, Crypto, Stripe Payment Gateway, Collaboration (Github Project, Teams, Zoom, Microsoft Cloud), Ai (gemini, n8n)",
    ],
  },
  {
    period: "Jan 2020 - Mar 2025",
    company: "PT Kode Kreatif Digital, Sidoarjo",
    timing: "Full Time, Hybrid",
    role: "Fullstack",
    description: [
      "Develop web apps and hybrid mobile apps (profile, online store, education, health, finance, custom)",
      "Digital marketing delivery: Google Ads and Meta Ads campaigns, SEO, analytics and conversion tracking, landing page optimization, and performance reporting for client products",
      "Technologies: TypeScript, Material UI, Tailwind, Ant Design, ReactJS, Redux, NextJS, Vue.js, ExpressJS, Laravel, React Native, Flutter, MySQL, PostgreSQL, ORM, GitHub, GraphQL, REST API, Web Socket, Golang, Python, Docker",
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
      "Built App/ Web Systems for Hospitals, Ners, Schools, Canteen from scratch to production with a focus on architecture, scalable systems, best performance server and UI/UX. ",
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
      "[BPJS-TK Sidoarjo] Correction data system. Main features: manage ticket (detail, attachments, verification, history, delete). Web base using Laravel, MySQL, ReactJS, BulmaCSS",
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
    items:
      "TypeScript, JavaScript (ES2015-ES2024), Dart, PHP 8, Go, Python, SQL, HTML5, CSS3, Bash & shell scripting, JSON, YAML, Markdown, regular expressions",
  },
  {
    group: "Languages & Web Foundations",
    category: "TypeScript & Type Systems",
    items:
      "Strict mode, generics & conditional types, mapped and template-literal types, discriminated unions, type guards & narrowing, utility types, declaration files & module augmentation, the satisfies operator, inference tuning, tsconfig & project references, runtime validation with Zod, end-to-end type-safe API contracts",
  },
  {
    group: "Languages & Web Foundations",
    category: "JavaScript Runtime & Language Internals",
    items:
      "Event loop, microtasks & macrotasks, promises & async/await, generators & iterators, closures & scope, prototypes & classes, ESM and CommonJS modules, memory management & garbage collection, Web Workers, structured cloning, Proxy & Reflect, immutability patterns, functional composition",
  },
  {
    group: "Languages & Web Foundations",
    category: "Semantic HTML & Accessibility Foundations",
    items:
      "Semantic HTML & document outline, landmark structure, forms & native validation, ARIA roles, states & properties, WCAG 2.2 AA, keyboard navigation & focus management, screen-reader testing, metadata & Open Graph, structured data with JSON-LD, progressive enhancement",
  },
  {
    group: "Languages & Web Foundations",
    category: "Modern CSS & Layout",
    items:
      "Flexbox, CSS Grid & subgrid, container queries, cascade layers, custom properties & design tokens, logical properties, clamp & fluid typography, :has() and modern selectors, native nesting, transitions & keyframe animation, view transitions, dark mode & prefers-color-scheme, responsive images, print stylesheets",
  },
  {
    group: "Languages & Web Foundations",
    category: "Browser Platform & Web APIs",
    items:
      "DOM & event delegation, Fetch & Streams, Web Storage & IndexedDB, Service Workers & PWA, WebSocket & Server-Sent Events, History & Navigation, Intersection, Resize & Mutation observers, Web Animations, Canvas & SVG, Clipboard, File & drag-and-drop, Geolocation, Notifications, Web Components & Shadow DOM, same-origin policy & CORS, Content Security Policy",
  },
  {
    group: "Frontend Engineering",
    category: "Frameworks & Rendering",
    items:
      "React 19, Next.js App Router, Remix, React Router v7, Preact, Vue.js, server-side rendering, static generation, incremental static regeneration, streaming SSR & Suspense, React Server Components, server actions, partial prerendering, client/server boundaries, hydration strategies, nested routing & layouts, middleware & edge rendering",
  },
  {
    group: "Frontend Engineering",
    category: "UI, Styling & Design Systems",
    items:
      "Tailwind CSS, Material UI, Ant Design, Bootstrap, Bulma, Emotion, Styled JSX, UnoCSS, Shadcn, Radix, Base UI, HeroUI, Fluent UI, Mantine, Chakra UI, Gluestack, Tamagui, design tokens & theming, component API design, compound & headless component patterns, variant systems with CVA and tailwind-merge, Storybook documentation, iconography, responsive and fluid layout systems",
  },
  {
    group: "Frontend Engineering",
    category: "State, Data & Forms",
    items:
      "Redux & Redux Toolkit, RTK Query, Zustand, Jotai, Valtio, Context, TanStack Query, SWR, Urql, Axios, Fetch, React Hook Form, Zod, RxJS, Lodash, React Hooks & custom hooks, loadable-components, server state versus client state, cache invalidation & optimistic updates, normalized stores, selectors & memoization, multi-step forms & field arrays, file upload handling, loading and error state modelling",
  },
  {
    group: "Frontend Engineering",
    category: "Motion, Visualization & Components",
    items:
      "GSAP, Framer Motion, Remotion, Lenis, ECharts, Recharts, Nivo, TanStack Table, Swiper, Embla Carousel, Onborda, React Flow, Mapbox, scroll-linked animation, timeline choreography, gesture & drag interactions, list and table virtualization, chart accessibility, reduced-motion support",
  },
  {
    group: "Frontend Engineering",
    category: "Performance & Core Web Vitals",
    items:
      "LCP, INP & CLS optimization, bundle analysis & code splitting, dynamic imports & lazy loading, tree shaking, route prefetching, image optimization & modern formats, font loading and FOUT/FOIT control, re-render elimination & memoization, React Profiler, list virtualization, critical CSS, resource hints (preload, preconnect), third-party script governance, CDN & caching strategy",
  },
  {
    group: "Frontend Engineering",
    category: "Accessibility & Inclusive UI",
    items:
      "WCAG 2.2 AA, semantic structure & landmarks, keyboard navigation & focus traps, ARIA patterns for dialogs, menus, tabs & comboboxes, screen-reader testing with NVDA and VoiceOver, colour contrast & visual hierarchy, reduced motion, form labelling & error messaging, skip links, axe and Lighthouse audits, internationalization & RTL support",
  },
  {
    group: "Frontend Engineering",
    category: "Frontend Architecture & Tooling",
    items:
      "Component-driven architecture, feature-first structure, module boundaries, monorepos with Turborepo and pnpm workspaces, Vite, Webpack, Turbopack, ESLint & Prettier configuration, TypeScript project references, environment configuration, dependency management, design-system packaging, incremental migration & refactoring strategy",
  },
  {
    group: "Frontend Engineering",
    category: "Client-Side Security",
    items:
      "XSS prevention & output encoding, Content Security Policy, CSRF protection, secure cookie and token handling, client session management, schema validation with Zod, HTML sanitization, dependency auditing, secrets hygiene in client bundles, iframe sandboxing & clickjacking protection",
  },
  {
    group: "Frontend Engineering",
    category: "Rich Text & Interface Libraries",
    items:
      "Tiptap, Plate, Quill, rich-text schema & serialization, collaborative editing patterns, Alpine.js, jQuery legacy maintenance, NotyJS and toast patterns, drag-and-drop interfaces, command palettes, keyboard shortcut systems, Algolia InstantSearch UI",
  },
  {
    group: "Backend & API Engineering",
    category: "Frameworks & Runtime",
    items:
      "Laravel, Laravel Octane, Symfony components, Express, Fastify, NestJS, Hono.js, Nitro, GoFiber, Gin, FastAPI, Node.js, Bun, Deno, PHP-FPM, serverless functions, edge runtimes, long-running workers & daemons, CLI tools & scheduled commands",
  },
  {
    group: "Backend & API Engineering",
    category: "API Design & Protocols",
    items:
      "REST, GraphQL schema design, resolvers, DataLoader & N+1 avoidance, schema stitching & federation, WebSocket, Server-Sent Events, gRPC, RPC & JSON-RPC, webhooks, OpenAPI/Swagger-first design, Larecipe, API versioning & deprecation policy, cursor and offset pagination, filtering, sorting & sparse fieldsets, idempotency keys, content negotiation, consistent error envelopes & problem details, rate limiting, throttling & quotas, HTTP semantics, status codes & caching headers",
  },
  {
    group: "Backend & API Engineering",
    category: "Authentication, Authorization & API Security",
    items:
      "OAuth2 & OpenID Connect, JWT with refresh-token rotation, session and cookie auth, Laravel Sanctum & Passport, Auth.js, Better Auth, API keys & scopes, HMAC webhook signature verification, RBAC & policy-based authorization, multi-tenant data scoping, CORS & CSRF protection, request validation & sanitization, injection and mass-assignment prevention, OWASP API Security Top 10, secrets management & credential rotation, encryption in transit and at rest, audit logging",
  },
  {
    group: "Backend & API Engineering",
    category: "Persistence, Transactions & Query Performance",
    items:
      "Eloquent, Prisma, Drizzle, GORM, query builders, schema migrations & seeders, ACID transactions & isolation levels, optimistic and pessimistic locking, N+1 elimination & eager loading, indexing strategy and EXPLAIN plan analysis, connection pooling, read replicas & write splitting, soft deletes & auditing, referential integrity & constraints, repository and service layers, data backfills & zero-downtime migrations",
  },
  {
    group: "Backend & API Engineering",
    category: "Async Processing, Queues & Events",
    items:
      "Laravel Queues & Horizon, BullMQ, Redis-backed queues, RabbitMQ, Amazon SQS, cron & task scheduling, background workers, retries with exponential backoff, dead-letter queues, job batching & chunking, rate-limited and unique jobs, pub/sub & event broadcasting, domain events & listeners, the outbox pattern, eventual consistency, idempotent consumers, long-running import and report pipelines",
  },
  {
    group: "Backend & API Engineering",
    category: "Caching, Performance & Scalability",
    items:
      "Redis caching, cache-aside, write-through & tagged invalidation, TTL tuning & stampede protection, HTTP caching with ETag and Cache-Control, CDN & edge caching, response compression, payload shaping & selective loading, query optimization, memoization & request coalescing, load and stress testing with k6, profiling & bottleneck analysis, stateless services & horizontal scaling, concurrency limits & backpressure, graceful degradation",
  },
  {
    group: "Backend & API Engineering",
    category: "Third-Party & Payment Integrations",
    items:
      "Stripe, Xendit, Midtrans, Polar, checkout, subscription & refund flows, webhook verification, replay handling & reconciliation, HubSpot CRM, mail and notification providers, WhatsApp & SMS gateways, S3 and object storage, Google APIs, OAuth app integrations, SDK and client-wrapper design, retries, timeouts & circuit breakers, sandbox versus production credentials, partner rate limits, failure isolation & fallbacks",
  },
  {
    group: "Backend & API Engineering",
    category: "Reliability & Service Operations",
    items:
      "Service instrumentation & request-scoped logging, health and readiness probes, graceful shutdown & signal handling, zero-downtime deploys & migration ordering, blue-green and canary rollout of services, feature flags & kill switches, environment and configuration management, connection and worker pool tuning, queue depth & backlog monitoring, runbook-driven operational response",
  },
  {
    group: "Backend & API Engineering",
    category: "Backend Testing & API Quality",
    items:
      "Pest, PHPUnit, Jest, Vitest, Testify, unit, integration & feature suites, API contract testing, database factories, fixtures & seeded test databases, HTTP mocking & service virtualization, snapshot testing of API payloads, Postman & Insomnia collections, static analysis with PHPStan & Larastan, type safety & linting, staging validation & release sign-off",
  },
  {
    group: "AI & Agentic Engineering",
    category: "Models & Providers",
    items:
      "Claude (Opus, Sonnet, Haiku), OpenAI GPT, Google Gemini, Llama, Anthropic and OpenAI SDKs, model selection & capability trade-offs, context-window planning, streaming responses, structured output & JSON mode, tool and function calling, vision and multimodal input, prompt caching, token accounting, latency and cost budgeting, rate-limit and retry handling, multi-provider fallback routing",
  },
  {
    group: "AI & Agentic Engineering",
    category: "Prompt & Context Engineering",
    items:
      "System, developer and user prompt design, few-shot and example selection, output schemas & structured extraction, decomposition and planning patterns, context assembly, pruning & token budgeting, instruction hierarchy & conflict handling, prompt versioning & regression testing, deterministic formatting, refusal and edge-case handling, repository rules and conventions files",
  },
  {
    group: "AI & Agentic Engineering",
    category: "Agentic Workflows",
    items:
      "Claude Code, Codex, Cursor/ VS Code/ ZED IDE, agentic CLIs & agents, MCP clients & servers, tool and function design, skills, subagents & multi-agent orchestration, structured plans and task decomposition, context engineering, repository rules & conventions files, hooks and permission policies, sandboxed execution, git worktree isolation, spec-driven and test-driven agentic loops, review & refactor agents, codebase retrieval, prompt and workflow versioning, evaluation harnesses & regression suites, guardrails, human-in-the-loop approval, token & cost budgeting, observability and audit trails, agents in CI/CD",
  },
  {
    group: "AI & Agentic Engineering",
    category: "LLM Application Architecture",
    items:
      "Chat and assistant interfaces, streaming UI over server-sent events, conversation state & memory, session persistence, system-prompt versioning, tool registries & function schemas, orchestration and routing layers, background inference jobs & queues, embedding and completion caching, graceful degradation on provider failure, usage metering & quota enforcement, provider abstraction layers",
  },
  {
    group: "AI & Agentic Engineering",
    category: "Retrieval & Vector Search",
    items:
      "Document preprocessing & chunking strategy, embeddings, pgvector, Pinecone, Qdrant, Supabase Vector, hybrid keyword and semantic search, reranking, metadata filtering & access-scoped retrieval, citation and source attribution, freshness & re-indexing strategy, retrieval quality evaluation, context assembly within token budgets",
  },
  {
    group: "AI & Agentic Engineering",
    category: "Evaluation, Safety & Guardrails",
    items:
      "Evaluation harnesses & regression suites, golden datasets, LLM-as-judge with human review, task success and hallucination metrics, red-teaming & prompt-injection defence, input and output filtering, PII redaction, tool-permission scoping & sandboxed execution, human-in-the-loop approval gates, audit trails, cost and latency monitoring, staged rollout gating",
  },
  {
    group: "AI & Agentic Engineering",
    category: "AI Product Integration",
    items:
      "AI features in production applications, chat and prediction modules, content generation & summarization, classification and extraction pipelines, document and image processing, search and recommendation assistance, workflow copilots, integration into existing Laravel and Next.js products, incremental rollout behind feature flags, user feedback capture, adoption and quality tracking",
  },
  {
    group: "Workflow Automation & n8n",
    category: "Core & Workflow Design",
    items:
      "n8n, workflow design & orchestration, Webhook, Schedule, Polling, Form and Chat triggers, Execute Workflow & sub-workflows, Merge, Loop Over Items, Split In Batches, IF, Switch, Filter, Wait, Stop and Error, error workflows, retries & continue-on-fail, pinned data, tags, folders, templates, workflow versioning",
  },
  {
    group: "Workflow Automation & n8n",
    category: "Nodes & Integrations",
    items:
      "HTTP Request, Webhook & Respond to Webhook, REST & GraphQL APIs, pagination, rate limiting & backoff, Google Workspace (Sheets, Drive, Gmail, Calendar), Slack, Notion, Airtable, HubSpot, Stripe, Telegram, WhatsApp, Discord, GitHub, Jira, Postgres, MySQL, MongoDB, Redis, S3, SFTP, RSS, community nodes, custom node development",
  },
  {
    group: "Workflow Automation & n8n",
    category: "AI & LLM Automation",
    items:
      "AI Agent and Chat Trigger nodes, basic and conversational LLM chains, OpenAI, Claude, Gemini and Ollama model nodes, tool calling, MCP client & server nodes, vector stores (Pinecone, Qdrant, Supabase, PGVector), embeddings, RAG pipelines, document loaders & text splitters, buffer/Postgres/Redis memory, structured output parsers, evaluation and human-in-the-loop approval",
  },
  {
    group: "Workflow Automation & n8n",
    category: "Data & Logic",
    items:
      "Code node in JavaScript and Python, n8n expressions, JMESPath, Edit Fields, Item Lists, Aggregate, Sort, Remove Duplicates, Date & Time, Crypto, JSON, XML, HTML and CSV parsing, binary and file handling, data mapping & schema shaping, idempotency keys, deduplication",
  },
  {
    group: "Workflow Automation & n8n",
    category: "Security & Credentials",
    items:
      "Credential management, OAuth2 and API key auth, JWT, HMAC webhook signature verification, header auth, environment variables & external secrets, RBAC and project permissions, SSO, audit logs, data redaction, retention policies",
  },
  {
    group: "Workflow Automation & n8n",
    category: "Deployment & Operations",
    items:
      "Self-hosted n8n on Docker and Docker Compose, n8n Cloud, queue mode with Redis and workers, Postgres persistence, horizontal scaling & concurrency tuning, separated webhook and worker processes, Nginx & Traefik reverse proxy, staging environments, Git-based source control, CI/CD, execution logging & pruning, monitoring, alerting, backup & restore",
  },
  {
    group: "Data & Storage",
    category: "Relational Databases",
    items:
      "PostgreSQL, MySQL, MariaDB, SQLite, Neon, Supabase, schema design & normalization, constraints & foreign keys, views & materialized views, stored procedures & triggers, window functions & CTEs, partitioning, full-text search, extensions such as PostGIS, pgvector and pg_trgm",
  },
  {
    group: "Data & Storage",
    category: "NoSQL & Document Stores",
    items:
      "MongoDB, Firebase Firestore, DynamoDB, Redis data structures, document modelling, embedding versus referencing, aggregation pipelines, secondary indexes, replica sets & sharding, TTL collections, denormalization trade-offs, eventual consistency",
  },
  {
    group: "Data & Storage",
    category: "Data Modelling & Integrity",
    items:
      "Entity-relationship design, normalization & deliberate denormalization, multi-tenant data isolation, soft deletes & audit trails, temporal and versioned records, referential integrity, data contracts & schema evolution, migration and backfill strategy, seeding & fixtures, idempotent imports",
  },
  {
    group: "Data & Storage",
    category: "Caching & In-Memory Stores",
    items:
      "Redis, Memcached, key design & namespacing, expiry & eviction policies, sorted sets, streams & pub/sub, distributed locks, session and rate-limit stores, cache warming, invalidation strategy, hit-rate monitoring",
  },
  {
    group: "Data & Storage",
    category: "Files, Object & Serverless Storage",
    items:
      "Amazon S3, Cloudflare R2, cloud storage buckets, presigned URLs, multipart & resumable uploads, CDN delivery, image and media pipelines, MIME validation & malware scanning, lifecycle policies & archival tiers, signed access & bucket permissions, retention policies",
  },
  {
    group: "Data & Storage",
    category: "Search, Analytics & Vector Data",
    items:
      "Full-text search, PostgreSQL tsvector, Algolia, Meilisearch, Elasticsearch, faceting, ranking & relevance tuning, typo tolerance, pgvector, Pinecone, Qdrant, Supabase Vector, embeddings & similarity search, aggregation & reporting queries, BigQuery and Looker Studio reporting, ETL and data-sync pipelines",
  },
  {
    group: "Data & Storage",
    category: "Backup, Recovery & Data Operations",
    items:
      "Backup scheduling & restore drills, point-in-time recovery, replication & read replicas, failover planning, migration rollback, data retention & deletion policies, PII handling, encryption at rest, anonymized non-production datasets, capacity monitoring & growth planning",
  },
  {
    group: "Architecture & Security",
    category: "Architecture Patterns",
    items:
      "Monolith, modular monolith, microservices, service-oriented, event-driven, serverless, monorepo, microkernel, hexagonal & clean architecture, CQRS, domain-driven design, layered and vertical-slice structure, backend-for-frontend, multi-tenancy models, strangler-fig migration",
  },
  {
    group: "Architecture & Security",
    category: "System Design & Scalability",
    items:
      "Requirements analysis & capacity planning, bounded contexts & service boundaries, data flow and sequence modelling, synchronous versus asynchronous communication, statelessness & horizontal scaling, load balancing, partitioning & sharding strategy, consistency and availability trade-offs, idempotency & retry semantics, failure-mode analysis, cost-aware design, phased migration & rollout planning",
  },
  {
    group: "Architecture & Security",
    category: "Application Security & Threat Management",
    items:
      "OWASP Top 10, threat modelling & attack-surface review, secure defaults & least privilege, input validation & output encoding, injection, XSS and SSRF prevention, access-control design, cryptography fundamentals, key & secret management, dependency and supply-chain auditing, SAST and DAST scanning, security headers, penetration-test remediation, responsible disclosure",
  },
  {
    group: "Architecture & Security",
    category: "Reliability & Resilience Engineering",
    items:
      "Redundancy & failover, timeouts, retries & exponential backoff, circuit breakers & bulkheads, rate limiting & load shedding, health checks, graceful degradation, disaster recovery planning, RTO and RPO targets, SLO definition & error-budget thinking, blast-radius containment, dependency failure isolation",
  },
  {
    group: "Architecture & Security",
    category: "Engineering Practices",
    items:
      "Clean code, design patterns, SOLID, OOP & functional programming, refactoring & technical-debt management, code review culture, pair programming, trunk-based development & branching strategy, Agile, Scrum, iterative delivery, estimation & scoping, definition of done, dependency management, coding standards & project conventions",
  },
  {
    group: "Architecture & Security",
    category: "Documentation & Decision Records",
    items:
      "Architecture decision records, system, sequence and data-flow diagrams, C4-style context modelling, interface and contract specifications, non-functional requirement documentation, runbooks & operational playbooks, trade-off write-ups, knowledge sharing & handover, technical writing for mixed audiences",
  },
  {
    group: "Architecture & Security",
    category: "Technical Leadership & Decision Making",
    items:
      "Solution shaping & technical scoping, trade-off analysis, build-versus-buy evaluation, technology selection & proof of concept, mentoring & code-review coaching, standards setting, cross-team alignment, risk identification & mitigation, delivery and roadmap planning, stakeholder and vendor communication, continuous improvement",
  },
  {
    group: "Cloud & Delivery",
    category: "Cloud Platforms & Hosting",
    items:
      "AWS (EC2, S3, RDS, Lambda, CloudFront, Route 53, IAM, SQS, SES), Cloudflare (Workers, R2, Pages, DNS, WAF), Vercel & Vercel Functions, VPS providers, managed databases, serverless and edge compute, region & availability planning, shared responsibility model",
  },
  {
    group: "Cloud & Delivery",
    category: "Containers & Orchestration",
    items:
      "Docker, multi-stage builds, Docker Compose, image optimization & layer caching, container registries, health checks & restart policies, resource limits, volumes & container networking, Kubernetes fundamentals, service discovery, autoscaling basics, local and production environment parity",
  },
  {
    group: "Cloud & Delivery",
    category: "CI/CD & Release Engineering",
    items:
      "GitHub Actions, pipeline design, build, test & deploy stages, dependency caching & artifact management, matrix builds, environment promotion, preview and staging deployments, blue-green & canary releases, zero-downtime deploys, database migration steps, release tagging & semantic versioning, rollback automation, deployment approvals & branch protection",
  },
  {
    group: "Cloud & Delivery",
    category: "Build Tooling & Bundling",
    items:
      "Vite, Webpack, Turbopack, Turborepo, esbuild, SWC, Babel, PostCSS, tree shaking & code splitting, bundle analysis, source maps, monorepo task pipelines & remote caching, build performance tuning, environment-specific builds",
  },
  {
    group: "Cloud & Delivery",
    category: "Infrastructure & Configuration",
    items:
      "Infrastructure as code, Terraform basics, environment & secrets management, Nginx and Traefik reverse proxy, load balancer configuration, SSL termination, DNS records & routing, firewall rules & security groups, systemd services, PM2 & process managers, cron and scheduled infrastructure tasks, server provisioning & hardening",
  },
  {
    group: "Cloud & Delivery",
    category: "Cost, Scaling & Capacity",
    items:
      "Autoscaling policies, pre-launch load testing, right-sizing instances and functions, cold-start mitigation, CDN offload, bandwidth and egress cost control, reserved versus on-demand capacity, budget alerts, resource tagging & cost attribution, performance versus cost trade-offs",
  },
  {
    group: "Quality & Observability",
    category: "Test Strategy & Automation",
    items:
      "Test pyramid & risk-based coverage, unit, integration, feature and end-to-end suites, Pest, PHPUnit, Jest, Vitest, Testify, Playwright, Cypress, Testing Library, regression & smoke suites, data mocking with MSW and JSON Server, factories & fixtures, flaky-test triage, coverage thresholds, test gates in CI",
  },
  {
    group: "Quality & Observability",
    category: "Frontend & Visual Testing",
    items:
      "Component testing with Testing Library, Playwright and Cypress end-to-end flows, visual regression & snapshot testing, Storybook interaction tests, cross-browser and device testing, accessibility testing with axe, responsive QA, user-journey validation",
  },
  {
    group: "Quality & Observability",
    category: "Debugging & Performance Analysis",
    items:
      "Browser DevTools, React Profiler, Node and PHP debuggers, breakpoint & step debugging, log tracing, network waterfall analysis, memory leak detection, flame graphs & bottleneck analysis, query profiling, performance budgets, load testing, release validation, production issue reproduction",
  },
  {
    group: "Quality & Observability",
    category: "Monitoring & Observability",
    items:
      "Structured logging & correlation IDs, log aggregation, error tracking with Sentry, uptime & synthetic monitoring, metrics, dashboards & alerting, distributed tracing, real user monitoring, Core Web Vitals field data, health checks, incident timelines & runbooks, alert tuning to reduce noise",
  },
  {
    group: "Quality & Observability",
    category: "Code Quality & Static Analysis",
    items:
      "Code review practice, consistent naming & project conventions, ESLint, Prettier, PHPStan & Larastan, type safety, complexity and duplication checks, pre-commit hooks, lint and format gates in CI, dependency updates & auditing, dead-code removal, refactoring discipline",
  },
  {
    group: "Quality & Observability",
    category: "Developer Experience & Tooling",
    items:
      "Local environment parity, containerized development setup, seed and demo data, developer scripts & task runners, fast feedback loops, hot reload & build-speed tuning, Storybook component workshop, editor, lint and formatter integration, onboarding paths, troubleshooting guides, internal tooling",
  },
  {
    group: "Quality & Observability",
    category: "Release Quality & Production Support",
    items:
      "Release checklists & sign-off, staging validation, feature flags & progressive rollout, post-deploy smoke testing, rollback criteria, bug triage & severity classification, SLA-based response, hotfix workflow, production support rotation, user-reported issue reproduction, postmortem follow-through",
  },
  {
    group: "Website Operations",
    category: "CMS & Website Platforms",
    items:
      "Shopify, WordPress, Elementor Pro, Statamic, Laravel, Next.js, PHP, headless CMS patterns, theme & template development, custom blocks and field types, plugin & extension development, multisite management, content modelling, editorial workflows, landing pages, content publishing",
  },
  {
    group: "Website Operations",
    category: "E-commerce Operations",
    items:
      "Shopify themes, Liquid & sections, product, variant & collection modelling, checkout customization, Shopify apps & Admin API, cart and discount logic, payment and shipping configuration, inventory sync, order workflows, subscription and membership flows, merchandising, product feeds, conversion-focused product and collection pages",
  },
  {
    group: "Website Operations",
    category: "Technical SEO & Site Performance",
    items:
      "Core Web Vitals, PageSpeed Insights, Lighthouse, crawlability & indexation, XML sitemaps & robots.txt, canonicalization & duplicate-content control, structured data and rich results, redirect mapping & migration SEO, international and hreflang setup, metadata & Open Graph, image and asset optimization, caching & CDN configuration, render-blocking resource removal, accessibility remediation, responsive optimization",
  },
  {
    group: "Website Operations",
    category: "Content Operations & Publishing",
    items:
      "Content modelling & taxonomy, editorial workflow & approvals, staging-to-live publishing, versioning & rollback, bulk content migration, media library governance, multilingual content, reusable component libraries for editors, editor training & documentation, content QA & broken-link checking",
  },
  {
    group: "Website Operations",
    category: "Security & Site Reliability",
    items:
      "Platform hardening, plugin and theme vetting, update & patch cadence, WAF and bot mitigation, DDoS protection, malware scanning & cleanup, backups & restore testing, uptime and error monitoring, staging and live environment parity, access control & least-privilege admin roles, form spam and abuse prevention",
  },
  {
    group: "Website Operations",
    category: "Hosting, Domains & Delivery",
    items:
      "Managed hosting, VPS & cloud hosting, Cloudflare DNS, caching & page rules, CDN configuration, SSL/TLS provisioning & renewal, domain and subdomain strategy, email deliverability with SPF, DKIM and DMARC, redirects & edge rules, environment variables & secrets, deployment pipelines for CMS sites, rollback procedures",
  },
  {
    group: "Integrations & Growth",
    category: "CRM & Marketing Automation",
    items:
      "HubSpot forms, workflows, lists & reporting, contact and deal pipelines, lead scoring & routing, CRM data hygiene & deduplication, lifecycle and nurture sequences, segmentation, email marketing automation, CRM-to-application integration over API and webhooks, n8n orchestration across CRM, notifications and reporting",
  },
  {
    group: "Integrations & Growth",
    category: "Analytics & Measurement",
    items:
      "GA4 event and conversion tracking, Google Tag Manager, server-side tagging, Google Search Console, Microsoft Clarity, Meta Pixel, Looker Studio dashboards, UTM taxonomy & campaign tagging, funnel and cohort analysis, attribution modelling, custom event schemas, data-layer design, consent mode & privacy-compliant tracking",
  },
  {
    group: "Integrations & Growth",
    category: "Funnels, Checkout & Conversion",
    items:
      "Lead capture & form optimization, booking flows, membership journeys, event registration, Stripe, Xendit, Midtrans and Polar checkout experiences, cart and abandonment recovery, landing page structure & offer alignment, CRO frameworks, A/B and multivariate testing, heatmaps & session replay, funnel drop-off analysis, personalization, user feedback loops",
  },
  {
    group: "Integrations & Growth",
    category: "Digital Advertising & Performance Marketing",
    items:
      "Google Ads (Search, Performance Max, Display, YouTube, Shopping), Meta Ads Manager, TikTok Ads, LinkedIn Ads, campaign structure & budget pacing, keyword research & negative keywords, audience segmentation, lookalike and retargeting audiences, ad copy and creative testing, landing page & offer alignment, Google Merchant Center and product feeds, server-side tagging, Conversions API, offline conversion import, attribution modelling, UTM taxonomy, ROAS, CPA and LTV analysis, bid strategies & budget allocation, Looker Studio reporting, email marketing and lifecycle automation, remarketing funnels",
  },
  {
    group: "Integrations & Growth",
    category: "SEO & Content Growth",
    items:
      "Keyword research & search-intent mapping, content strategy & topic clusters, on-page optimization & copy briefs, internal linking strategy, local SEO & Google Business Profile, SERP feature targeting, competitor and gap analysis, content refresh cadence, landing page and blog growth programmes, backlink and digital-PR basics, SEO performance reporting & forecasting",
  },
  {
    group: "Integrations & Growth",
    category: "Notifications & Messaging",
    items:
      "Transactional email with SendGrid, Postmark and Amazon SES, WhatsApp Business API, SMS gateways, push notifications, in-app notifications, Slack and Telegram alerting, template management & personalization, deliverability monitoring, opt-in and unsubscribe compliance, notification preference handling, n8n notification pipelines",
  },
  {
    group: "Flutter Engineering",
    category: "Language & Core",
    items:
      "Flutter, Flutter SDK, Dart, sound null safety, strong typing, Futures & async/await, Streams & StreamController, isolates & compute, generics, mixins, extension methods, sealed classes & pattern matching, records, error handling, lifecycle & memory management",
  },
  {
    group: "Flutter Engineering",
    category: "UI & Rendering",
    items:
      "Widget/Element/RenderObject tree, Material 3, Cupertino, slivers & CustomScrollView, custom painters & render objects, LayoutBuilder, responsive and adaptive layouts, theming & design tokens, implicit and explicit animations, AnimationController, Hero transitions, Rive, Lottie, fragment shaders, intl localization, accessibility semantics",
  },
  {
    group: "Flutter Engineering",
    category: "State Management",
    items:
      "Riverpod, Bloc/Cubit, Provider, GetX, MobX, InheritedWidget, ChangeNotifier & ValueNotifier, signals, immutable state with freezed, state restoration, dependency scoping",
  },
  {
    group: "Flutter Engineering",
    category: "Architecture & Code Generation",
    items:
      "Clean architecture, MVVM, feature-first modularization, repository pattern, get_it & injectable DI, go_router & Navigator 2.0, deep links, build_runner, freezed, json_serializable, Pigeon, Melos monorepos, build flavors & environment config",
  },
  {
    group: "Flutter Engineering",
    category: "Data & Networking",
    items:
      "Dio, Retrofit, http, REST, GraphQL, WebSocket, gRPC, interceptors, retries & auth refresh, Hive, Isar, Drift, sqflite, shared_preferences, flutter_secure_storage, offline-first sync, caching & pagination",
  },
  {
    group: "Flutter Engineering",
    category: "Platform & Native Integration",
    items:
      "Platform channels, Pigeon, Dart FFI, Kotlin & Swift interop, Firebase (Auth, Firestore, Messaging, Crashlytics, Remote Config, Analytics), push notifications, in-app purchase, maps, camera, permissions, biometrics, background tasks, WebView",
  },
  {
    group: "Flutter Engineering",
    category: "Testing & Performance",
    items:
      "Unit, widget, golden, and integration_test suites, mocktail & mockito, patrol, DevTools, timeline & memory profiling, jank and rebuild analysis, const & RepaintBoundary tuning, deferred loading, app size reduction",
  },
  {
    group: "Flutter Engineering",
    category: "Build & Release",
    items:
      "Fastlane, Codemagic, GitHub Actions, code signing, build flavors, Play Store & App Store release, staged rollouts, Firebase App Distribution, TestFlight, Crashlytics monitoring, web & desktop targets",
  },
  {
    group: "React Native Engineering",
    category: "Core & Runtime",
    items:
      "React Native, New Architecture (Fabric, TurboModules, JSI), Hermes, bridgeless mode, Expo & EAS, bare workflow, Metro bundler, monorepo setup, React 19 concurrent features, OTA updates with EAS Update",
  },
  {
    group: "React Native Engineering",
    category: "UI & Interaction",
    items:
      "Flexbox layout, StyleSheet, NativeWind, Reanimated, Gesture Handler, Skia, Lottie, FlashList & FlatList virtualization, SafeArea, responsive and adaptive layouts, dark mode theming, accessibility props, i18n",
  },
  {
    group: "React Native Engineering",
    category: "Navigation & State",
    items:
      "React Navigation, Expo Router, deep links & universal links, Redux Toolkit, Zustand, Jotai, MobX, Context, TanStack Query, RTK Query, React Hook Form, Zod",
  },
  {
    group: "React Native Engineering",
    category: "Data & Offline Storage",
    items:
      "REST, GraphQL with Apollo & urql, WebSocket, Axios, MMKV, AsyncStorage, WatermelonDB, Realm, SQLite, Keychain & Keystore secure storage, offline-first sync, caching & pagination",
  },
  {
    group: "React Native Engineering",
    category: "Modules & Device",
    items:
      "TurboModules & legacy native modules, Kotlin/Java and Swift/Objective-C interop, Expo config plugins, Firebase (Auth, Firestore, Messaging, Crashlytics, Remote Config, Analytics), push notifications, in-app purchase, Mapbox & Google Maps, camera, permissions, biometrics, background tasks, WebView",
  },
  {
    group: "React Native Engineering",
    category: "Testing & Performance",
    items:
      "Jest, React Native Testing Library, Detox, Maestro, MSW, React DevTools & Flipper, Hermes profiling, re-render analysis, list performance, startup time & bundle size, memory leak tracing",
  },
  {
    group: "React Native Engineering",
    category: "Build & Release",
    items:
      "EAS Build & Submit, Fastlane, GitHub Actions, Bitrise, code signing & provisioning, build flavors & schemes, Play Store & App Store release, staged rollouts, OTA updates, Sentry & Crashlytics monitoring",
  },
  {
    group: "Design & Product Experience",
    category: "Product Design & UX",
    items:
      "Figma, pen.dev, Adobe XD, Eraser, auto layout, components & variants, prototyping, wireframing, user flows & journey mapping, information architecture, usability review, responsive and adaptive design, accessibility in design, design QA & developer handoff",
  },
  {
    group: "Design & Product Experience",
    category: "Design Systems & Tokens",
    items:
      "Token architecture across colour, spacing, typography, radius and elevation, theming & dark mode, component specification & interaction states, variant matrices, naming conventions, Storybook documentation, design-to-code parity, contribution & versioning workflow, cross-platform consistency",
  },
  {
    group: "Design & Product Experience",
    category: "Visual & Brand Design",
    items:
      "Photoshop, Illustrator, CorelDRAW, Lightroom, typography & type scales, colour theory & palettes, layout and grid systems, iconography, brand consistency, marketing and social assets, image editing & retouching, export and asset optimization",
  },
  {
    group: "Design & Product Experience",
    category: "UX Research & Validation",
    items:
      "Stakeholder and user interviews, requirement gathering, competitor and heuristic review, usability testing, task analysis, session replay & heatmap review, surveys & feedback collection, analytics-informed design decisions, hypothesis framing, iteration on measured outcomes",
  },
  {
    group: "Design & Product Experience",
    category: "Content & Interaction Design",
    items:
      "Microcopy & UX writing, empty, loading and error states, form design & validation messaging, onboarding flows, progressive disclosure, motion and transition principles, feedback & affordance design, responsive interaction patterns, inclusive design considerations",
  },
  {
    group: "Project Management & Collaboration",
    category: "Version Control & Code Collaboration",
    items:
      "Git, GitHub, branching strategy & pull-request workflow, code review etiquette, conventional commits, merge versus rebase, release tagging & changelogs, issue templates & labels, project boards, repository conventions & CODEOWNERS, VS Code and collaborative editing",
  },
  {
    group: "Project Management & Collaboration",
    category: "Project Management",
    items:
      "Jira, Microsoft Planner, GitHub Projects, Trello, Notion, Agile planning & backlog grooming, sprint coordination, estimation & capacity planning, milestone and release planning, progress tracking & reporting, dependency and risk management, scope and change control, retrospectives",
  },
  {
    group: "Project Management & Collaboration",
    category: "Communication & Stakeholders",
    items:
      "Slack, Microsoft Teams, WhatsApp, Google Meet, Zoom, Microsoft 365, Microsoft Cloud, Google Workspace, cross-functional communication, requirement clarification, technical explanation for non-technical audiences, status and escalation reporting, client and vendor coordination, expectation management, async and remote collaboration",
  },
  {
    group: "Project Management & Collaboration",
    category: "Delivery & Team Practices",
    items:
      "Scrum ceremonies, kanban flow, definition of ready and done, work breakdown & task decomposition, prioritization frameworks, cross-timezone collaboration, handover & knowledge transfer, onboarding new team members, mentoring & pairing, continuous improvement",
  },
  {
    group: "Project Management & Collaboration",
    category: "Client & Product Collaboration",
    items:
      "Discovery workshops & requirement gathering, proposal and scope documentation, demo and walkthrough sessions, feedback collection & triage, acceptance criteria, UAT coordination, training and handover documentation, post-launch support planning, ongoing maintenance engagements",
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
    title: "Claude Code",
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

// Newest first: the list reads as a timeline, so a new entry slots in by date.
export const achievements: Achievement[] = [
  {
    title: "Favorite Employee",
    description: "Yayasan IIK Bhakti Wiyata, Surabaya",
    period: "2018 - 2019",
  },
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
