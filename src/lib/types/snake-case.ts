/**
 * Type Safety Utilities for snake_case Enforcement
 *
 * This file provides TypeScript utilities to enforce consistent snake_case
 * naming across the codebase, from database to frontend.
 */

/**
 * Convert a string type to snake_case
 *
 * @example
 * type Test1 = SnakeCase<'userId'>; // 'user_id'
 * type Test2 = SnakeCase<'isPublic'>; // 'is_public'
 * type Test3 = SnakeCase<'createdAt'>; // 'created_at'
 */
export type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? '_' : ''}${Lowercase<T>}${SnakeCase<U>}`
  : S;

/**
 * Convert all keys in an object type to snake_case
 *
 * @example
 * type User = { userId: string; isActive: boolean; createdAt: Date };
 * type SnakeCaseUser = ToSnakeCase<User>;
 * // Result: { user_id: string; is_active: boolean; created_at: Date }
 */
export type ToSnakeCase<T> = {
  [K in keyof T as SnakeCase<K & string>]: T[K] extends object
    ? ToSnakeCase<T[K]>
    : T[K];
};

/**
 * Convert a string type from snake_case to camelCase
 *
 * @example
 * type Test1 = CamelCase<'user_id'>; // 'userId'
 * type Test2 = CamelCase<'is_public'>; // 'isPublic'
 * type Test3 = CamelCase<'created_at'>; // 'createdAt'
 */
export type CamelCase<S extends string> = S extends `${infer P}_${infer Q}${infer R}`
  ? `${P}${Capitalize<Q>}${CamelCase<R>}`
  : S;

/**
 * Convert all keys in an object type from snake_case to camelCase
 *
 * @example
 * type SnakeUser = { user_id: string; is_active: boolean; created_at: Date };
 * type CamelUser = ToCamelCase<SnakeUser>;
 * // Result: { userId: string; isActive: boolean; createdAt: Date }
 */
export type ToCamelCase<T> = {
  [K in keyof T as CamelCase<K & string>]: T[K] extends object
    ? ToCamelCase<T[K]>
    : T[K];
};

/**
 * Runtime helper: Convert object keys from camelCase to snake_case
 *
 * @param obj - Object with camelCase keys
 * @returns New object with snake_case keys
 *
 * @example
 * const camelObj = { userId: '123', isActive: true, createdAt: new Date() };
 * const snakeObj = toSnakeCase(camelObj);
 * // Result: { user_id: '123', is_active: true, created_at: Date }
 */
export function toSnakeCase<T extends Record<string, any>>(obj: T): ToSnakeCase<T> {
  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    // Convert camelCase to snake_case
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

    // Recursively convert nested objects
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[snakeKey] = toSnakeCase(value);
    } else {
      result[snakeKey] = value;
    }
  }

  return result;
}

/**
 * Runtime helper: Convert object keys from snake_case to camelCase
 *
 * @param obj - Object with snake_case keys
 * @returns New object with camelCase keys
 *
 * @example
 * const snakeObj = { user_id: '123', is_active: true, created_at: new Date() };
 * const camelObj = toCamelCase(snakeObj);
 * // Result: { userId: '123', isActive: true, createdAt: Date }
 */
export function toCamelCase<T extends Record<string, any>>(obj: T): ToCamelCase<T> {
  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    // Recursively convert nested objects
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[camelKey] = toCamelCase(value);
    } else {
      result[camelKey] = value;
    }
  }

  return result;
}

/**
 * Type guard to ensure an object follows snake_case naming
 *
 * This is a compile-time check only - it doesn't perform runtime validation
 */
export type EnsureSnakeCase<T> = {
  [K in keyof T]: K extends string
    ? K extends SnakeCase<K>
      ? T[K]
      : never
    : T[K];
};

/**
 * Type guard to ensure an object follows camelCase naming
 *
 * This is a compile-time check only - it doesn't perform runtime validation
 */
export type EnsureCamelCase<T> = {
  [K in keyof T]: K extends string
    ? K extends CamelCase<K>
      ? T[K]
      : never
    : T[K];
};
