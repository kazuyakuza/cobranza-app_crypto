/**
 * Structural shape helpers for testing AES-256-GCM encrypted values.
 *
 * Provides the {@link encryptedMatchesShape} predicate and its input types,
 * enabling deterministic structural assertions against non-deterministic
 * ciphertext (random IV per encryption).
 *
 * @packageDocumentation
 */

/** Deterministic structural shape of an `EncryptedValue` (no exact ciphertext). */
export interface ExpectedEncryptedShape {
  readonly algorithm: 'aes-256-gcm';
  readonly keyName: string;
  readonly version: number;
  readonly encryptedDataByteLength: number;
}

/** Minimal `EncryptedValue`-like input for {@link encryptedMatchesShape}. */
export interface EncryptedMatchInput {
  readonly algorithm?: string;
  readonly keyName: string;
  readonly version?: number;
  readonly encryptedData: string;
}

/** Inputs to {@link encryptedMatchesShape}. */
export interface EncryptedMatchParams {
  readonly encrypted: EncryptedMatchInput;
  readonly vector: {
    readonly expectedEncryptedShape: ExpectedEncryptedShape;
    readonly version: number;
  };
}

/** Whether an `EncryptedValue` matches a vector's deterministic structural shape. */
export function encryptedMatchesShape(params: EncryptedMatchParams): boolean {
  const { encrypted, vector } = params;
  const shape = vector.expectedEncryptedShape;

  return encrypted.algorithm === shape.algorithm
    && encrypted.keyName === shape.keyName
    && (encrypted.version ?? vector.version) === shape.version
    && Buffer.from(encrypted.encryptedData, 'base64').length === shape.encryptedDataByteLength;
}
