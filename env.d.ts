/// <reference types="vite/client" />
declare module "virtual:react-router/server-build" {
  import type { ServerBuild } from "react-router"
  export const assets: ServerBuild["assets"]
  export const assetsBuildDirectory: ServerBuild["assetsBuildDirectory"]
  export const basename: ServerBuild["basename"]
  export const entry: ServerBuild["entry"]
  export const future: ServerBuild["future"]
  export const isSpaMode: ServerBuild["isSpaMode"]
  export const mode: ServerBuild["mode"]
  export const publicPath: ServerBuild["publicPath"]
  export const routes: ServerBuild["routes"]
}
