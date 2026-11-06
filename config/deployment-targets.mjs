/** Public deployment identity. Never add credentials to this module or manifests. */
export const DEPLOYMENT_TARGETS = Object.freeze({
  production: Object.freeze({
    workerName: "indrax",
    previewName: undefined,
    siteUrl: "https://indrax.uk",
    mediaOrigin: "https://media.indrax.uk",
  }),
  staging: Object.freeze({
    workerName: "indrax",
    previewName: "develop",
    siteUrl: "https://develop.previews.indrax.uk",
    mediaOrigin: "https://dev-media.indrax.uk",
  }),
  // Temporary rollback target and local Workerd build, not a Worker Preview.
  dev: Object.freeze({
    workerName: "indrax-dev",
    previewName: undefined,
    siteUrl: "https://dev.indrax.uk",
    mediaOrigin: "https://dev-media.indrax.uk",
  }),
})

/** @param {string} name */
export function getDeploymentTarget(name) {
  if (!Object.hasOwn(DEPLOYMENT_TARGETS, name))
    throw new Error("Choose production, staging or dev as the deployment target.")
  return DEPLOYMENT_TARGETS[/** @type {keyof typeof DEPLOYMENT_TARGETS} */ (name)]
}

/** Exact origin validation prevents a deployment response or CI input redirecting credentials.
 * @param {string} target
 * @param {string} origin
 */
export function assertTargetOrigin(target, origin) {
  if (origin !== getDeploymentTarget(target).siteUrl)
    throw new Error(`Deployment origin does not match ${target}.`)
  return origin
}

/** @param {Record<string, string | undefined>} env */
export function buildTarget(env = process.env) {
  if (!env.DEPLOYMENT_TARGET) return undefined
  const target = getDeploymentTarget(env.DEPLOYMENT_TARGET)
  if (env.CLOUDFLARE_ENV && env.CLOUDFLARE_ENV !== (env.DEPLOYMENT_TARGET === "dev" ? "dev" : ""))
    throw new Error("CLOUDFLARE_ENV conflicts with DEPLOYMENT_TARGET.")
  return target
}
