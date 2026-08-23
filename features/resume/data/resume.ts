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
  title: "Software Engineer · Full-Stack",
  email: "indracahyae@gmail.com",
  phone: "+62 813 3563 0404",
  location: "Surabaya, Indonesia",
  birthDate: "1994-03-22",
  birthPlace: "Surabaya",
  gender: "Male",
  status: "Married",
  address: "Bali, Indonesia",
  github: "https://github.com/indraxyz",
  website: "https://indrax.my.id",
  highlightSkills: [
    "Modern Frontend",
    "Backend, APIs & Integrations",
    "SQL & NoSQL Databases",
    "Cloud Deployment & CI/CD",
    "Testing, Debugging & Performance",
    "System Architecture",
    "AI Automation & Agentic Workflows",
    "Product UI/UX & Design Systems",
  ],
}

export const bio = `Software engineer and web developer with 9 years building, maintaining,  improving production apps, websites and digital products.
I partner closely with app, design, marketing and business teams for developments, campaigns and requirements to turn into polished, measurable web experiences.`

export const experiences: ExperienceItem[] = [
  {
    period: "Apr 2026 - Present",
    company: "Juicebox Indonesia, South Denpasar, Bali",
    timing: "Full Time, Hybrid",
    role: "Software Engineer",
    description: [
      "Build and maintain production websites and product features across Laravel, Statamic, Next.js, and WordPress, with a focus on responsive UX, clean implementation, reliable releases, and fast issue resolution.",
      "Own delivery across MySQL, MariaDB, and PostgreSQL data; Docker, Redis, cloud storage, AWS/VPS CI/CD; Stripe and Xendit payment integrations; unit, feature, and automated testing; and collaboration with Jira, Slack, WhatsApp, Trello, and GitHub.",
      "Use Figma, pen.dev, GSAP, and Lenis for polished digital experiences, and apply AI API integration and agentic workflows with Claude, Codex, MCP, and skills to improve delivery efficiency.",
      "Website growth and operations: HubSpot forms and automation, Google Tag Manager, GA4 event and conversion tracking, Google Search Console, Microsoft Clarity, technical SEO, Core Web Vitals, PageSpeed optimization, Elementor Pro, CRO and A/B testing, security and performance, and hospitality booking, membership, event, and lead-generation funnels.",
    ],
  },
  {
    period: "Apr 2025 - Apr 2026",
    company: "Primuse, Canggu, Bali",
    timing: "Full Time, Hybrid",
    role: "Software Engineer",
    description: [
      "Core team of Kisum App, development from inception, to production with a focus on architecture, scalable systems with best UI/UX and multi-tenant. Key modules developed include Artists, AI (Chat, Prediction), News, Events & Financials, Festivals, Venues, Vendors, and Market.",
      "Technologies: TypeScript, NextJs, UiUx (Tailwind & Shadcn, Redux/ Zustand/ Context, Tanstack, Mapbox, Swiper, Onborda, Echarts/ Recharts, Figma, Axios, Async, Hooks, React-hook-form, Zod ), GraphQL, WebSocket, REST API, JWT, Stripe, Figma, Jest, docker, github, Turbopack, MongoDB & PostgreSQL, Redis, Aws & Cloudflare, microservices, serverless (Lambda, Cloudflare Workers), express, Web Socket, Crypto, Stripe Payment Gateway, Github, Collaboration (Github Project, Teams, Zoom, Microsoft Cloud), Ai (gemini, n8n)",
    ],
  },
  {
    period: "Jan 2020 - Mar 2025",
    company: "PT Kode Kreatif Digital, Sidoarjo",
    timing: "Full Time, Hybrid",
    role: "Fullstack",
    description: [
      "Develop web apps and hybrid mobile apps (profile, online store, education, health, finance, custom)",
      "Technologies: TypeScript, Material UI, Tailwind, Ant Design, ReactJS, Redux, NextJS, ExpressJS, Laravel, React Native, MySQL, PostgreSQL, ORM, GitHub, GraphQL, REST API, Web Socket, Golang, Python, Docker, Kubernetes",
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

export const portfolioItems: PortfolioItem[] = [
  {
    title: "Manage Student,  Product, Task",
    description:
      "data table management with proper uiux & performance with Next.js, React Router/ Remix,  MongoDB, GraphQL, React 19, TypeScript, Vite/ Turbopack, Tailwind CSS v4 (fullstack application) enhanced for optimal maintainability and scalability.",
    year: "2025",
  },
  {
    title: "Calculator",
    description:
      "beautiful, secure that built with React 19, TypeScript, Vite, Tailwind CSS v4, and React Router v7. This calculator combines modern design with robust security measures, excellent user experience, optimized code architecture.",
    year: "2025",
  },
  {
    title: "TodoApp",
    description:
      "todoApp (kanban board) q with drag drop functionality use Typescript, NextJs, NextUi, tailwind, motion.",
    year: "2025",
  },
  {
    title: "Pokedex",
    description:
      "search about pokemons that built with typescript, nextJs, material ui, tailwind, pokemon api v2.",
    year: "2025",
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
    title: "Belov",
    description:
      "Correction data system. Main features: manage ticket (detail, attachments, verification, history, delete). Web base using Laravel, MySQL, ReactJS, BulmaCSS",
    year: "2022",
  },
  {
    title: "Parkir",
    description:
      "Parking management system. Main features: auto select location, park entrance and out, tariff and payment, report. Web base using Laravel, Tailwind, MySQL",
    year: "2021",
  },
  {
    title: "Crimenesia",
    description:
      "Crime reporting system between police and society. Main features: crime reporting and crime mapping. Web and android platform using Laravel, MySQL, jQuery, Semantic, NotyJS, ReactJS, React Native",
    year: "2017",
  },
]

export const techSkills = [
  "Architect and evolve scalable, maintainable software systems from requirements through production",
  "Apply clean code, strong design principles, structured problem-solving, and pragmatic engineering judgment",
  "Deliver full-stack web products with consistent ownership across frontend, backend, data, integrations, and release quality",
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
    items: "TypeScript, JavaScript, PHP, Go, Python, SQL, HTML, CSS",
  },
  {
    group: "Languages & Web Foundations",
    category: "Web Standards",
    items: "Responsive web development, accessibility, semantic HTML, modern CSS, browser APIs, JSON, web performance fundamentals",
  },
  {
    group: "Frontend Engineering",
    category: "Frameworks & Rendering",
    items: "React, Next.js, Remix, React Router, Preact, Server-side rendering, static generation, server components",
  },
  {
    group: "Frontend Engineering",
    category: "UI, Styling & Design Systems",
    items: "Tailwind CSS, Material UI, Ant Design, Bootstrap, Bulma, Semantic UI, Emotion, Styled JSX, UnoCSS, shadcn/ui, Radix, HeroUI, Fluent UI, Mantine, Chakra UI, Gluestack, Tamagui",
  },
  {
    group: "Frontend Engineering",
    category: "State, Data & Forms",
    items: "Redux, Zustand, Context, TanStack Query, Axios, Fetch, React Hook Form, Zod, Urql, Lodash, RxJS, async utilities, React Hooks, loadable-components",
  },
  {
    group: "Frontend Engineering",
    category: "Motion, Visualization & Components",
    items: "GSAP, Framer Motion, Remotion, Lenis, ECharts, Recharts, Nivo, TanStack Table, Swiper, Embla Carousel, Onborda, React Flow, Mapbox",
  },
  {
    group: "Backend & API Engineering",
    category: "Frameworks & Runtime",
    items: "Laravel, Express, Hono.js, GoFiber, Gin, Node.js, serverless functions",
  },
  {
    group: "Backend & API Engineering",
    category: "APIs & Communication",
    items: "REST, GraphQL, WebSocket, RPC, JSON-RPC, webhooks, async workflows, API documentation with Swagger",
  },
  {
    group: "Data & Storage",
    category: "Databases",
    items: "PostgreSQL, MySQL, MariaDB, MongoDB, Supabase, Firebase, Neon, SQL and NoSQL data modeling",
  },
  {
    group: "Data & Storage",
    category: "ORM, Cache & Storage",
    items: "Prisma, Drizzle, ORM patterns, Redis, object storage, cloud storage, serverless storage, query optimization",
  },
  {
    group: "Architecture & Security",
    category: "Architecture Patterns",
    items: "Monolith, modular monolith, microservices, service-oriented, event-driven, serverless, monorepo, microkernel",
  },
  {
    group: "Architecture & Security",
    category: "Authentication & Application Security",
    items: "JWT, Auth.js, Better Auth, access control, input validation, secure API design, cryptography fundamentals",
  },
  {
    group: "Architecture & Security",
    category: "Engineering Practices",
    items: "Clean architecture, design patterns, OOP, functional programming, Agile, Scrum, iterative delivery",
  },
  {
    group: "Website Operations",
    category: "CMS & Website Platforms",
    items: "WordPress, Elementor Pro, PHP, Statamic, Next.js, Laravel, landing pages, content publishing",
  },
  {
    group: "Website Operations",
    category: "Performance, SEO & Accessibility",
    items: "Core Web Vitals, PageSpeed Insights, technical SEO, responsive optimization, accessibility, metadata, structured content",
  },
  {
    group: "Website Operations",
    category: "Security & Site Reliability",
    items: "Platform security, plugin management, updates, backups, monitoring, staging/live environments, DNS, SSL",
  },
  {
    group: "Cloud & Delivery",
    category: "Cloud & Hosting",
    items: "AWS, Cloudflare, Vercel, VPS, AWS Lambda, Cloudflare Workers, Vercel Functions",
  },
  {
    group: "Cloud & Delivery",
    category: "Containers, CI/CD & Build",
    items: "Docker, Kubernetes, GitHub workflows, CI/CD, Webpack, Turbopack, Vite, Turborepo, VPS deployment",
  },
  {
    group: "Quality & Observability",
    category: "Testing",
    items: "Jest, Vitest, Testify, unit testing, integration testing, feature testing, regression testing, JSON Server, data mocking",
  },
  {
    group: "Quality & Observability",
    category: "Debugging & Performance",
    items: "Browser DevTools, React Profiler, log tracing, bottleneck analysis, performance tuning, release validation",
  },
  {
    group: "Integrations & Growth",
    category: "CRM, Analytics & Automation",
    items: "HubSpot forms, workflows, reporting, GA4, Google Tag Manager, Google Search Console, Microsoft Clarity, Meta Pixel, n8n",
  },
  {
    group: "Integrations & Growth",
    category: "Funnels, Payments & Conversion",
    items: "Stripe, Xendit, Midtrans, Polar, lead capture, booking flows, membership journeys, event registration, CRO, A/B testing",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "React Native",
    items: "React Native, Expo, React Navigation, FlashList, Firebase, Mapbox, notifications, hardware modules",
  },
  {
    group: "Mobile & Specialized Product UI",
    category: "Rich Interfaces",
    items: "Tiptap, Plate, Quill, React Flow, Mapbox, Algolia, Alpine.js, jQuery, NotyJS, RxJS, Lodash",
  },
  {
    group: "AI & Automation",
    category: "AI Platforms & Models",
    items: "OpenAI, Claude, Gemini, Llama, AI APIs, prompt design, evaluation, and human-in-the-loop review",
  },
  {
    group: "AI & Automation",
    category: "Agentic Workflows",
    items: "n8n, MCP, Codex, Claude Code, VS Code/Cursor, agentic cli & tools, skills, structured plans, rules, and AI-agentic engineering workflows",
  },
  {
    group: "Design & Product Experience",
    category: "Product Design & UX",
    items: "Figma, pen.dev, Adobe XD, Eraser, Photoshop, Illustrator, CorelDRAW, Lightroom, design systems, UX review, user flows, visual QA",
  },
  {
    group: "Project Management & Collaboration",
    category: "Development & Documentation",
    items: "Git, GitHub, VS Code, Storybook, Swagger, technical documentation, decision records",
  },
  {
    group: "Project Management & Collaboration",
    category: "Project Management",
    items: "Jira, Microsoft Planner, GitHub Projects, Trello, Notion, Agile planning, sprint coordination, progress tracking, risk management",
  },
  {
    group: "Project Management & Collaboration",
    category: "Communication & Stakeholders",
    items: "Slack, Microsoft Teams, WhatsApp, Google Meet, Zoom, Microsoft 365, Microsoft Cloud, Google Workspace, cross-functional communication, vendor coordination",
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
  },
  {
    title: "N8n Integrations & Automations",
    issuer: "MySkill",
    period: "Jun 2026",
    link: "https://www.linkedin.com/safety/go/?url=https%3A%2F%2Fstorage.googleapis.com%2Fmyskill-v2-certificates%2Fcourse-OZLZZJOr9qUzEB0JLbDk%2FrnHNapLUn7RYMFGW0JWkQBBpTTa2-M8zTyO8pby9zYg0uuqhc.pdf&urlhash=u3TY&mt=_icNjnn8-94jHaJN35EiGKqVsFuarQ6zqnhg-kViy-sApL4BbpNgO43l_Iall3ikF2CZlrdlGZMJ-sK2T7GaAm4B3UY&isSdui=true&lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base_certifications_details%3BpVejrEsuST2iAdxnRoy4mA%3D%3D",
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
  },
  {
    title: "8th Best Graduate",
    description: "SMPN 3 Waru (Junior High School)",
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
