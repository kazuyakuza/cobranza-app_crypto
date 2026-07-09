/**
 * Configuration interfaces and `EncryptionKey` enum for `@cobranza-apps/crypto`.
 *
 * Defines:
 * - {@link EncryptionKey} — key category enum (PII, COMPANY_PII, BANK_DATA, NOTIFICATION, GENERAL).
 * - {@link CryptoConfig} — constructor options for {@link SecureCrypto} (masterKey, hashSalt,
 *   currentVersion, defaultKeyName).
 *
 * @packageDocumentation
 */

import type { AuditLogger } from './audit.js';

/**
 * Logical key categories used to derive per-domain encryption keys via HKDF.
 *
 * The string value is what gets stored on `EncryptedValue.keyName` (brief §5).
 */
export enum EncryptionKey {
  /** Personal Identifiable Information (names, emails, phones, fullName, contact, etc.) */
  PII = 'pii',

  /** Company-level PII (businessName, taxId, etc.) */
  COMPANY_PII = 'company_pii',

  /** Bank-related data (transaction description, reference, notes) */
  BANK_DATA = 'bank_data',

  /** Notification content (subject, body) */
  NOTIFICATION = 'notification',

  /** General / fallback for other sensitive fields */
  GENERAL = 'general',
}

/**
 * Constructor configuration for {@link SecureCrypto}.
 *
 * All values MUST be provided explicitly (no `process.env` reads inside the library).
 * `masterKey` and `hashSalt` are expected to originate from a NestJS `ConfigService` at the
 * consumer side (brief §7).
 *
 * @example
 * const config: CryptoConfig = {
 *   masterKey: process.env.MASTER_KEY!, // base64 32-byte key, injected by ConfigService
 *   hashSalt: process.env.HASH_SALT!,   // base64 >=32-byte salt, injected by ConfigService
 *   currentVersion: 1,
 *   defaultKeyName: EncryptionKey.PII,
 * };
 */
export interface CryptoConfig {
  /** Base64-encoded 32-byte master key (decoded to AES-256 key material). */
  masterKey: string;

  /** Base64-encoded salt for deterministic hashing (>= 32 bytes). */
  hashSalt: string;

  /** Current key version (increment on rotation). Defaults to 1 when omitted. */
  readonly currentVersion?: number;

  /** Default key category applied when `keyName` is not passed explicitly. */
  readonly defaultKeyName?: EncryptionKey;

  /** Optional audit hooks fired after successful encrypt/decrypt. See {@link AuditLogger}. */
  readonly auditLogger?: AuditLogger;
}
