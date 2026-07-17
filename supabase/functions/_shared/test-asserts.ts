/**
 * std/assert-compatible assertion helpers for Deno tests.
 *
 * The canonical import is `jsr:@std/assert`, but this sandbox's network egress
 * returns 403 for jsr.io / deno.land / esm.sh, so remote imports can't be
 * fetched to run the tests here. This module re-exports the same
 * assertEquals / assertThrows / assert / assertExists / assertStringIncludes
 * API implemented on Deno's built-in `node:assert` (no network needed).
 *
 * In a networked environment you can replace imports of this module with:
 *   import { assertEquals, assertThrows } from "jsr:@std/assert";
 * and the tests are unchanged.
 */
import { deepStrictEqual, throws as nodeThrows, ok } from 'node:assert';

export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  deepStrictEqual(actual, expected, msg);
}

export function assert(expr: unknown, msg?: string): void {
  ok(expr, msg);
}

export function assertExists<T>(actual: T, msg?: string): void {
  ok(actual !== null && actual !== undefined, msg ?? `Expected value to exist, got ${actual}`);
}

export function assertThrows(fn: () => unknown, msg?: string): void {
  nodeThrows(fn, msg ? { message: msg } : undefined);
}

export function assertStringIncludes(actual: string, expected: string, msg?: string): void {
  ok(
    actual.includes(expected),
    msg ?? `Expected "${actual}" to include "${expected}"`
  );
}
