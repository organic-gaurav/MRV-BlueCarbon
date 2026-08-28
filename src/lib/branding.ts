/**
 * Single source of truth for how the app presents itself.
 * Change these values to re-brand the whole prototype.
 */

export const BRAND = {
  /** product name shown in the sidebar and browser tab */
  product: "MRV-BlueCarbon",
  /** GitHub / hackathon handle of the owner */
  handle: "@organic-gaurav",
  owner: "organic-gaurav",
  github: "https://github.com/organic-gaurav",
  /** shown under the wordmark in the sidebar */
  tagline: "Blue carbon MRV platform",
  version: "v0.1",
  /** credit line used in the sidebar footer and on printed reports */
  credit: "Built by @organic-gaurav",
  /** printed on the monitoring report footer */
  reportFooter: "Prepared with MRV-BlueCarbon · @organic-gaurav",
} as const;
