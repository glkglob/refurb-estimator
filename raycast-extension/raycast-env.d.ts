/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** API Base URL - Base URL for your Next.js app (e.g. http://localhost:3000) */
  "apiBaseUrl": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `quick-estimate` command */
  export type QuickEstimate = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `quick-estimate` command */
  export type QuickEstimate = {}
}

