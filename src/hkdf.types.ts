/**
 * Input parameters for {@link deriveKey} (internal HKDF derivation).
 *
 * Encapsulates the three derivation inputs as a single object to comply with the
 * max-arguments-per-method rule.
 */
export interface DeriveKeyParams {
  /** Base64-encoded 32-byte master key. */
  readonly masterKey: string;

  /** Logical key category (e.g. `EncryptionKey.PII`) or arbitrary key name string. */
  readonly keyName: string;

  /** Optional key version (included in HKDF `info` when provided, for rotation support). */
  readonly version?: number;
}
