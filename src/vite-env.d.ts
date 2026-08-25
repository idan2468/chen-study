/// <reference types="vite/client" />

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- vite/client declares ImportMetaEnv as an interface; augmenting it requires one too
interface ImportMetaEnv {
  /** OAuth client ID for Drive sync; public by design, see docs/google-account-sync.md. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}
