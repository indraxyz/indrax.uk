import { createBundledHighlighter, createSingletonShorthands } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

// Explicit imports bound Worker size; unknown languages remain readable plain text.
// Aliases point to the same grammar, and each grammar loads only when an article needs it.
const javascript = () => import("shiki/langs/javascript.mjs")
const typescript = () => import("shiki/langs/typescript.mjs")
const bash = () => import("shiki/langs/bash.mjs")
const python = () => import("shiki/langs/python.mjs")
const markdown = () => import("shiki/langs/markdown.mjs")
const yaml = () => import("shiki/langs/yaml.mjs")

export const createHighlighter = createBundledHighlighter<string, string>({
  langs: {
    javascript,
    js: javascript,
    typescript,
    ts: typescript,
    jsx: () => import("shiki/langs/jsx.mjs"),
    tsx: () => import("shiki/langs/tsx.mjs"),
    html: () => import("shiki/langs/html.mjs"),
    css: () => import("shiki/langs/css.mjs"),
    json: () => import("shiki/langs/json.mjs"),
    bash,
    sh: bash,
    shell: bash,
    sql: () => import("shiki/langs/sql.mjs"),
    python,
    py: python,
    php: () => import("shiki/langs/php.mjs"),
    markdown,
    md: markdown,
    yaml,
    yml: yaml,
  },
  themes: {
    "github-light-high-contrast": () => import("shiki/themes/github-light-high-contrast.mjs"),
    "github-dark": () => import("shiki/themes/github-dark.mjs"),
  },
  engine: () => createJavaScriptRegexEngine(),
})

export const { getSingletonHighlighter } = createSingletonShorthands(createHighlighter)
