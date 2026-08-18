/**
 * Joins class names, dropping anything falsy.
 *
 * Needed because CSS Module members are typed `string | undefined` under
 * `noUncheckedIndexedAccess`, so interpolating them into a template literal is
 * a type error. This keeps the call sites readable without weakening the flag.
 */
export const cx = (...classNames: (string | false | null | undefined)[]) =>
  classNames.filter(Boolean).join(" ")
