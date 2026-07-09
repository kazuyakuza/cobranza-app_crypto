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

// --- Single-section helpers extracted from the compound predicate ---

function algorithmMatches(
  encrypted: EncryptedMatchInput,
  shape: ExpectedEncryptedShape,
): boolean {
  return encrypted.algorithm === shape.algorithm;
}

function keyNameMatches(
  encrypted: EncryptedMatchInput,
  shape: ExpectedEncryptedShape,
): boolean {
  return encrypted.keyName === shape.keyName;
}

function versionMatches(
  encrypted: EncryptedMatchInput,
  vector: EncryptedMatchParams['vector'],
): boolean {
  return (encrypted.version ?? vector.version) === vector.expectedEncryptedShape.version;
}

function payloadLengthMatches(
  encrypted: EncryptedMatchInput,
  shape: ExpectedEncryptedShape,
): boolean {
  const decodedLength = Buffer.from(encrypted.encryptedData, 'base64').length;
  return decodedLength === shape.encryptedDataByteLength;
}

/** Whether an `EncryptedValue` matches a vector's deterministic structural shape. */
export function encryptedMatchesShape(params: EncryptedMatchParams): boolean {
  const { encrypted, vector } = params;
  const shape = vector.expectedEncryptedShape;

  return algorithmMatches(encrypted, shape)
    && keyNameMatches(encrypted, shape)
    && versionMatches(encrypted, vector)
    && payloadLengthMatches(encrypted, shape);
}
