/**
 * Audit logger interface for optional observability of SecureCrypto operations.
 *
 * Consumers implement this and pass an instance via `CryptoConfig.auditLogger`.
 * Hooks receive ONLY non-sensitive metadata (`keyName`, `version`) — never
 * plaintext or ciphertext. This is enforced at the type level: the interface
 * signatures have no parameter capable of carrying sensitive payload data.
 *
 * @packageDocumentation
 * @module audit
 */

/**
 * Optional observability hooks invoked after successful encrypt/decrypt
 * operations. Implementations MUST NOT throw; any thrown error is swallowed
 * by the notifier so a misbehaving logger can never break a crypto operation.
 *
 * @example
 * ```ts
 * import type { AuditLogger } from '@cobranza-apps/crypto';
 *
 * const logger: AuditLogger = {
 *   onEncrypt(keyName, version) { metrics.increment('encrypt', { keyName, version }); },
 *   onDecrypt(keyName, version) { metrics.increment('decrypt', { keyName, version }); },
 * };
 * // pass via CryptoConfig.auditLogger
 * ```
 */
export interface AuditLogger {
  /** Invoked once after each successful `encrypt` (incl. transitive callers). */
  onEncrypt(keyName: string, version: number): void;
  /** Invoked once after each successful `decrypt` (incl. transitive callers). */
  onDecrypt(keyName: string, version: number): void;
}
