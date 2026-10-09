import { index, route, type RouteConfig } from "@react-router/dev/routes"
export default [
  index("../routes/home.tsx"),
  route("resume", "../routes/resume.tsx"),
  route("tech-stack", "../routes/tech-stack.tsx"),
  route("writing", "../routes/writing.tsx"),
  route("writing/search", "../routes/writing-search.tsx"),
  route("writing/tags/:tag", "../routes/writing-tag.tsx"),
  route("writing/series/:slug", "../routes/writing-series.tsx"),
  route("writing/:slug/preview", "../routes/writing-preview.tsx"),
  route("writing/:slug", "../routes/writing-detail.tsx"),
  route("*", "../routes/not-found.tsx"),
] satisfies RouteConfig
