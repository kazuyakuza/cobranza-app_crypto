/**
 * Audit notifier helpers for {@link module:crypto.service}.
 *
 * Encapsulates the null-guard + error-swallowing logic so the facade stays
 * under the 200-line limit. Notifier functions are the ONLY bridge between
 * `SecureCrypto` and a consumer-provided {@link AuditLogger}.
 *
 * @remarks
 * Hooks fire ONLY after a successful crypto operation. A logger that throws
 * is silently swallowed — audit must never break encryption/decryption.
 *
 * @module crypto.service.audit
 */

import type { AuditLogger } from './audit.js';

/** Inputs for {@link notifyEncrypt} and {@link notifyDecrypt}. */
export interface AuditNotifyParams {
  /** Consumer-provided logger; no-op when undefined. */
  readonly auditLogger: AuditLogger | undefined;
  /** Key name used for the operation (never plaintext or ciphertext). */
  readonly keyName: string;
  /** Key version used for the operation. */
  readonly version: number;
}

/**
 * Fire `auditLogger.onEncrypt` after a successful encrypt.
 * No-op when `auditLogger` is undefined; swallows any thrown error.
 */
export function notifyEncrypt(params: AuditNotifyParams): void {
  const { auditLogger, keyName, version } = params;
  if (!auditLogger) {
    return;
  }
  try {
    auditLogger.onEncrypt(keyName, version);
  } catch {
    /* swallow — audit must never break crypto */
  }
}

/**
 * Fire `auditLogger.onDecrypt` after a successful decrypt.
 * No-op when `auditLogger` is undefined; swallows any thrown error.
 */
export function notifyDecrypt(params: AuditNotifyParams): void {
  const { auditLogger, keyName, version } = params;
  if (!auditLogger) {
    return;
  }
  try {
    auditLogger.onDecrypt(keyName, version);
  } catch {
    /* swallow — audit must never break crypto */
  }
}
