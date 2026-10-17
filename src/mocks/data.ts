/**
 * Every fixture in one import path.
 *
 * The builders live in `./fixtures` — split by domain so each stays readable —
 * but callers only ever need this module. Flipping NEXT_PUBLIC_ENABLE_MOCKS off
 * is what makes the real backend answer instead.
 */

export * from "@/mocks/fixtures";