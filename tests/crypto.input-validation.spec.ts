/**
 * Unit tests for input-validation guards and public-method validation hardening.
 */
import { EncryptionKey } from '../src/index.js';
import { getTestCrypto } from '../src/testing/index.js';
import {
  assertValidEncryptedValue,
  assertValidHash,
  assertValidPlaintext,
} from '../src/crypto.service.guards.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

const MAX_PLAINTEXT_BYTES = 1_000_000;
const OVER_LIMIT_PLAINTEXT = 'A'.repeat(MAX_PLAINTEXT_BYTES + 1);

describe('assertValidPlaintext', () => {
  it('passes for an empty string', () => {
    expect(() => assertValidPlaintext('')).not.toThrow();
  });

  it('passes for a plaintext at the maximum length', () => {
    expect(() => assertValidPlaintext('A'.repeat(MAX_PLAINTEXT_BYTES))).not.toThrow();
  });

  it('throws when the plaintext exceeds the maximum byte length', () => {
    expect(() => assertValidPlaintext(OVER_LIMIT_PLAINTEXT)).toThrow(/exceeds maximum/);
  });
});

describe('assertValidHash', () => {
  it('throws for an empty expectedHash', () => {
    expect(() => assertValidHash('')).toThrow(/non-empty base64/);
  });

  it('throws for a non-base64 expectedHash', () => {
    expect(() => assertValidHash('not-valid-base64!')).toThrow(/valid base64/);
  });

  it('passes for a valid base64 expectedHash', () => {
    expect(() => assertValidHash(getTestCrypto().hash('x'))).not.toThrow();
  });
});

describe('assertValidEncryptedValue — extended', () => {
  it('throws when encryptedData is not valid base64', () => {
    const value: EncryptedValue = { encryptedData: '!!!not-base64!!!', keyName: 'pii' };

    expect(() => assertValidEncryptedValue(value)).toThrow(/valid base64/);
  });

  it('throws when encryptedData exceeds the maximum length', () => {
    const value: EncryptedValue = { encryptedData: 'A'.repeat(2_000_001), keyName: 'pii' };

    expect(() => assertValidEncryptedValue(value)).toThrow(/exceeds maximum/);
  });
});

describe('SecureCrypto — public-method input validation', () => {
  it('encrypt throws when plaintext exceeds the maximum length', () => {
    expect(() => getTestCrypto().encrypt(OVER_LIMIT_PLAINTEXT, EncryptionKey.PII)).toThrow(/exceeds maximum/);
  });

  it('hash throws when plaintext exceeds the maximum length', () => {
    expect(() => getTestCrypto().hash(OVER_LIMIT_PLAINTEXT)).toThrow(/exceeds maximum/);
  });

  it('verifyHash throws when plaintext exceeds the maximum length', () => {
    const crypto = getTestCrypto();
    const hash = crypto.hash('small');

    expect(() => crypto.verifyHash(OVER_LIMIT_PLAINTEXT, hash)).toThrow(/exceeds maximum/);
  });

  it('verifyHash throws when expectedHash is empty', () => {
    expect(() => getTestCrypto().verifyHash('small', '')).toThrow(/non-empty base64/);
  });

  it('verifyHash throws when expectedHash is not valid base64', () => {
    expect(() => getTestCrypto().verifyHash('small', 'not-base64!')).toThrow(/valid base64/);
  });

  it('decrypt throws when encryptedData is not valid base64', () => {
    expect(() =>
      getTestCrypto().decrypt({ encryptedData: '!!!not-base64!!!', keyName: 'pii', version: 1 }),
    ).toThrow(/valid base64/);
  });
});
