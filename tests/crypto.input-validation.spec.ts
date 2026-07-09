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
    expect(() => assertValidHash('')).toThrow(/expected a non-empty string/);
  });

  it('throws for a non-base64 expectedHash', () => {
    expect(() => assertValidHash('not-valid-base64!')).toThrow(/valid base64/);
  });

  it('passes for a valid base64 expectedHash', () => {
    expect(() => assertValidHash(getTestCrypto().hash('x'))).not.toThrow();
  });
});

describe('assertValidPlaintext — runtime type guards', () => {
  it('throws when plaintext is not a string', () => {
    expect(() => assertValidPlaintext(123 as unknown as string)).toThrow(/expected a string/);
    expect(() => assertValidPlaintext(null as unknown as string)).toThrow(/expected a string/);
    expect(() => assertValidPlaintext(undefined as unknown as string)).toThrow(/expected a string/);
    expect(() => assertValidPlaintext({} as unknown as string)).toThrow(/expected a string/);
  });
});

describe('assertValidEncryptedValue — version & algorithm', () => {
  const base = (overrides: Partial<EncryptedValue>): EncryptedValue =>
    ({ encryptedData: 'AAAA', keyName: 'pii', ...overrides });

  it('throws when version is zero', () => {
    expect(() => assertValidEncryptedValue(base({ version: 0 }))).toThrow(/positive integer/);
  });
  it('throws when version is negative', () => {
    expect(() => assertValidEncryptedValue(base({ version: -1 }))).toThrow(/positive integer/);
  });
  it('throws when version is a non-integer', () => {
    expect(() => assertValidEncryptedValue(base({ version: 1.5 }))).toThrow(/positive integer/);
  });
  it('throws when version is a string', () => {
    expect(() => assertValidEncryptedValue(base({ version: '1' as unknown as number }))).toThrow(/positive integer/);
  });
  it('passes when version is a positive integer', () => {
    expect(() => assertValidEncryptedValue(base({ version: 1 }))).not.toThrow();
  });
  it('passes when version is undefined', () => {
    expect(() => assertValidEncryptedValue(base({}))).not.toThrow();
  });
  it('throws when algorithm is unsupported', () => {
    expect(() => assertValidEncryptedValue(base({ algorithm: 'aes-128-gcm' }))).toThrow(/aes-256-gcm/);
  });
  it('throws when algorithm is a number', () => {
    expect(() => assertValidEncryptedValue(base({ algorithm: 1 as unknown as string }))).toThrow(/aes-256-gcm/);
  });
  it('passes when algorithm is aes-256-gcm', () => {
    expect(() => assertValidEncryptedValue(base({ algorithm: 'aes-256-gcm' }))).not.toThrow();
  });
  it('passes when algorithm is undefined', () => {
    expect(() => assertValidEncryptedValue(base({}))).not.toThrow();
  });
  it('throws when encryptedData is not a string', () => {
    expect(() => assertValidEncryptedValue(base({ encryptedData: 123 as unknown as string }))).toThrow(/expected a string/);
  });
  it('throws when keyName is not a string', () => {
    expect(() => assertValidEncryptedValue(base({ keyName: 42 as unknown as string }))).toThrow(/expected a string/);
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
  let crypto: ReturnType<typeof getTestCrypto>;

  beforeEach(() => {
    crypto = getTestCrypto();
  });

  it('encrypt throws when plaintext exceeds the maximum length', () => {
    expect(() => crypto.encrypt(OVER_LIMIT_PLAINTEXT, EncryptionKey.PII)).toThrow(/exceeds maximum/);
  });

  it('hash throws when plaintext exceeds the maximum length', () => {
    expect(() => crypto.hash(OVER_LIMIT_PLAINTEXT)).toThrow(/exceeds maximum/);
  });

  it('verifyHash throws when plaintext exceeds the maximum length', () => {
    const hash = crypto.hash('small');

    expect(() => crypto.verifyHash(OVER_LIMIT_PLAINTEXT, hash)).toThrow(/exceeds maximum/);
  });

  it('verifyHash throws when expectedHash is empty', () => {
    expect(() => crypto.verifyHash('small', '')).toThrow(/expected a non-empty string/);
  });

  it('verifyHash throws when expectedHash is not valid base64', () => {
    expect(() => crypto.verifyHash('small', 'not-base64!')).toThrow(/valid base64/);
  });

  it('decrypt throws when encryptedData is not valid base64', () => {
    expect(() =>
      crypto.decrypt({ encryptedData: '!!!not-base64!!!', keyName: 'pii', version: 1 }),
    ).toThrow(/valid base64/);
  });
});
