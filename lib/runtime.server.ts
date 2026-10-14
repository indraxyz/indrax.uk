import { AsyncLocalStorage } from "node:async_hooks"

export type RuntimeEnv = Record<string, unknown>
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void
}
interface RequestContext {
  request: Request
  env: RuntimeEnv
  executionContext?: ExecutionContextLike
}
const requests = new AsyncLocalStorage<RequestContext>()

export function runWithRequest<T>(
  request: Request,
  env: RuntimeEnv,
  executionContext: ExecutionContextLike | undefined,
  run: () => T
): T {
  return requests.run({ request, env, executionContext }, run)
}
export function getRequest(): Request {
  const context = requests.getStore()
  if (!context) throw new Error("No active request context.")
  return context.request
}
export function getRuntimeEnv(): RuntimeEnv {
  return requests.getStore()?.env ?? process.env
}
export function getExecutionContext(): ExecutionContextLike | undefined {
  return requests.getStore()?.executionContext
}
export function serverEnv(name: string): string | undefined {
  const value = getRuntimeEnv()[name]
  return typeof value === "string" ? value : undefined
}
