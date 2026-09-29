import styles from "./build-process-section.module.css"

const steps = [
  {
    number: "01",
    title: "Specify the outcome",
    description:
      "Use spec-driven development (SDD) to define the problem, constraints, and acceptance criteria before building.",
  },
  {
    number: "02",
    title: "Living context & memory",
    description:
      "Maintain a living record of decisions, assumptions, and lessons so every handoff starts with current context.",
  },
  {
    number: "03",
    title: "Multi-agent work",
    description:
      "Give build and review agents clear scopes, shared context, and checkpoints for integrating their work.",
  },
  {
    number: "04",
    title: "Layered testing",
    description:
      "Check focused logic, integrations, real browser paths, and accessibility according to the risk of the change.",
  },
  {
    number: "05",
    title: "Learn and update",
    description:
      "Use test evidence and human feedback to improve the result, then update the spec and shared memory.",
  },
] as const

const participants = [
  { x: 85, label: "You" },
  { x: 250, label: "Spec + memory" },
  { x: 415, label: "Build agent" },
  { x: 580, label: "Review agent" },
  { x: 745, label: "Test layers" },
] as const

const messages = [
  { from: 0, to: 1, y: 130, label: "Define acceptance criteria" },
  { from: 1, to: 2, y: 195, label: "Share context + build scope" },
  { from: 1, to: 3, y: 260, label: "Assign independent review" },
  { from: 2, to: 4, y: 325, label: "Run unit + integration checks" },
  { from: 3, to: 2, y: 390, label: "Return findings + edge cases" },
  { from: 2, to: 4, y: 455, label: "Run browser + accessibility checks" },
  { from: 4, to: 0, y: 520, label: "Present evidence for release" },
  { from: 0, to: 1, y: 585, label: "Feed back decisions + learning" },
] as const

export function BuildProcessSection() {
  return (
    <section aria-labelledby="process-heading" className="mb-8 print:hidden">
      <div className="overflow-hidden border-2 border-border bg-[var(--semantic-surface-muted)]">
        <div className="p-6 sm:p-8 lg:p-10">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--semantic-action-secondary)]">
            How I work
          </p>
          <h2 id="process-heading" className="text-2xl font-black uppercase sm:text-3xl">
            From Ideation to Production
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            A spec-driven workflow keeps product decisions visible, gives multiple agents useful
            context, and tests each change in layers before feedback starts the next cycle.
          </p>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            {steps.map((step) => (
              <li key={step.number}>
                <h3 className="text-xs font-black uppercase text-[var(--semantic-action-secondary)]">
                  {step.number} / {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <figure className="border-t-2 border-border bg-[var(--semantic-action-primary)] text-[var(--semantic-action-primary-text)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-6 sm:px-8 lg:px-10">
            <h3 className="text-sm font-black uppercase tracking-wide">The delivery sequence</h3>
            <p className="text-xs opacity-80">
              Follow top to bottom · scroll sideways to see all lanes
            </p>
          </div>
          <div className="overflow-x-auto px-2 sm:px-6 lg:px-8">
            <svg
              aria-hidden="true"
              viewBox="0 0 830 630"
              className="mx-auto block h-auto w-full min-w-[900px] max-w-[1100px]"
            >
              <defs>
                <marker
                  id="process-arrowhead"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M 1 1 L 9 5 L 1 9 Z" fill="currentColor" />
                </marker>
              </defs>

              {participants.map((participant) => (
                <g key={participant.label}>
                  <rect
                    x={participant.x - 72}
                    y="20"
                    width="144"
                    height="48"
                    rx="4"
                    fill="var(--semantic-surface-page)"
                  />
                  <text
                    x={participant.x}
                    y="49"
                    textAnchor="middle"
                    fill="var(--semantic-text-primary)"
                    fontSize="10"
                    fontWeight="800"
                  >
                    {participant.label}
                  </text>
                  <line
                    x1={participant.x}
                    y1="78"
                    x2={participant.x}
                    y2="607"
                    className={styles.lifeline}
                  />
                </g>
              ))}

              {messages.map((message, index) => {
                const start = participants[message.from].x
                const end = participants[message.to].x
                const direction = Math.sign(end - start)
                const lineStart = start + direction * 10
                const lineEnd = end - direction * 12
                const path = `M ${lineStart} ${message.y} H ${lineEnd}`
                const tracePath = `M ${lineStart} ${message.y} H ${lineEnd - direction * 12}`

                return (
                  <g key={message.label}>
                    <text
                      x={(start + end) / 2}
                      y={message.y - 13}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="currentColor"
                    >
                      {String(index + 1).padStart(2, "0")} · {message.label}
                    </text>
                    <path
                      d={path}
                      className={styles.baseLine}
                      markerEnd="url(#process-arrowhead)"
                    />
                    <path
                      d={tracePath}
                      pathLength="1"
                      className={styles.trace}
                      style={{ animationDelay: `${index * 2.5}s` }}
                    />
                  </g>
                )
              })}
            </svg>
          </div>
          <figcaption className="border-t border-current/30 px-6 py-4 text-xs leading-relaxed sm:px-8 lg:px-10">
            The release decision stays with a person. Feedback updates the spec and living context
            for the next cycle.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
