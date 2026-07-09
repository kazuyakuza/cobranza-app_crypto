/**
 * Unit tests for AuditLogger hooks wired into SecureCrypto.
 * Verifies hook firing, ordering, sensitive-data exclusion, error swallowing,
 * per-field bulk behavior, and cache-miss-only firing.
 */
import { EncryptionKey } from '../src/index.js';
import type { AuditLogger } from '../src/index.js';
import { SecureCrypto } from '../src/crypto.service.js';
import { TEST_CRYPTO_CONFIG, buildTestCrypto } from '../src/testing/index.js';
import { notifyEncrypt, notifyDecrypt } from '../src/crypto.service.audit.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

interface AuditCall {
  method: 'onEncrypt' | 'onDecrypt';
  keyName: string;
  version: number;
  args: unknown[];
}

function createSpyLogger(): { logger: AuditLogger; calls: AuditCall[] } {
  const calls: AuditCall[] = [];
  const logger: AuditLogger = {
    onEncrypt(keyName, version) {
      calls.push({ method: 'onEncrypt', keyName, version, args: [keyName, version] });
    },
    onDecrypt(keyName, version) {
      calls.push({ method: 'onDecrypt', keyName, version, args: [keyName, version] });
    },
  };
  return { logger, calls };
}

function buildCryptoWithAuditLogger(logger: AuditLogger, version = 1): SecureCrypto {
  return new SecureCrypto({ ...TEST_CRYPTO_CONFIG, currentVersion: version, auditLogger: logger });
}

function buildCryptoAndLogger(version = 1): { crypto: SecureCrypto; calls: AuditCall[] } {
  const { logger, calls } = createSpyLogger();
  const crypto = buildCryptoWithAuditLogger(logger, version);
  return { crypto, calls };
}

function resetCalls(calls: AuditCall[]): void {
  calls.length = 0;
}

describe('SecureCrypto — AuditLogger hooks', () => {
  describe('basic encrypt/decrypt hook firing', () => {
    it('fires onEncrypt once with keyName and currentVersion after encrypt()', () => {
      const { crypto, calls } = buildCryptoAndLogger(1);

      crypto.encrypt('secret-data', EncryptionKey.PII);

      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      expect(call.method).toBe('onEncrypt');
      expect(call.keyName).toBe(EncryptionKey.PII);
      expect(call.version).toBe(1);
    });

    it('fires onDecrypt once with payload keyName and resolved version after decrypt()', () => {
      const { crypto, calls } = buildCryptoAndLogger(2);

      const encrypted = crypto.encrypt('secret-data', EncryptionKey.BANK_DATA);
      resetCalls(calls);

      crypto.decrypt(encrypted);

      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      expect(call.method).toBe('onDecrypt');
      expect(call.keyName).toBe(EncryptionKey.BANK_DATA);
      expect(call.version).toBe(2);
    });

    it('decrypt() falls back to currentVersion when payload has no version field', () => {
      const { crypto, calls } = buildCryptoAndLogger(3);

      const encrypted = crypto.encrypt('data', EncryptionKey.PII);
      resetCalls(calls);
      const withoutVersion: EncryptedValue = {
        encryptedData: encrypted.encryptedData,
        keyName: encrypted.keyName,
      };

      crypto.decrypt(withoutVersion);

      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      expect(call.method).toBe('onDecrypt');
      expect(call.version).toBe(3);
    });
  });

  describe('transitive hook firing', () => {
    it('encryptAndHash() fires onEncrypt exactly once and never a decrypt hook', () => {
      const { crypto, calls } = buildCryptoAndLogger(1);

      crypto.encryptAndHash('pii-data', EncryptionKey.PII);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.method).toBe('onEncrypt');
    });

    it('reEncrypt() fires onDecrypt then onEncrypt in order', () => {
      const { crypto, calls } = buildCryptoAndLogger(2);

      const encrypted = crypto.encrypt('rotate-me', EncryptionKey.PII);
      resetCalls(calls);

      crypto.reEncrypt(encrypted, EncryptionKey.BANK_DATA);

      expect(calls.map((c) => c.method)).toEqual(['onDecrypt', 'onEncrypt']);
      expect(calls[0]!.keyName).toBe(EncryptionKey.PII);
      expect(calls[0]!.version).toBe(2);
      expect(calls[1]!.keyName).toBe(EncryptionKey.BANK_DATA);
      expect(calls[1]!.version).toBe(2);
    });

    it('encryptObject() fires onEncrypt once per mapped field', () => {
      const { crypto, calls } = buildCryptoAndLogger(1);

      const obj = { a: 'val1', b: 'val2', c: 'val3' };
      crypto.encryptObject(obj, { a: EncryptionKey.PII, b: EncryptionKey.BANK_DATA, c: EncryptionKey.GENERAL });

      expect(calls).toHaveLength(3);
      const keyNames = calls.map((c) => c.keyName);
      expect(keyNames).toEqual([EncryptionKey.PII, EncryptionKey.BANK_DATA, EncryptionKey.GENERAL]);
      for (const call of calls) {
        expect(call.method).toBe('onEncrypt');
      }
    });

    it('decryptObject() fires onDecrypt once per mapped field', () => {
      const { crypto, calls } = buildCryptoAndLogger(1);

      const obj = { a: 'val1', b: 'val2' };
      const encryptedObj = crypto.encryptObject(obj, { a: EncryptionKey.PII, b: EncryptionKey.GENERAL });
      resetCalls(calls);

      crypto.decryptObject(encryptedObj, { a: EncryptionKey.PII, b: EncryptionKey.GENERAL });

      expect(calls).toHaveLength(2);
      const keyNames = calls.map((c) => c.keyName);
      expect(keyNames).toEqual([EncryptionKey.PII, EncryptionKey.GENERAL]);
      for (const call of calls) {
        expect(call.method).toBe('onDecrypt');
      }
    });
  });

  describe('sensitive-data and error handling', () => {
    it('never passes plaintext or ciphertext to any hook', () => {
      const plaintext = 'my-sensitive-plaintext';
      const { crypto, calls } = buildCryptoAndLogger(1);

      const encrypted = crypto.encrypt(plaintext, EncryptionKey.PII);
      crypto.decrypt(encrypted);

      expect(calls.length).toBeGreaterThanOrEqual(2);
      for (const call of calls) {
        expect(call.args).toHaveLength(2);
        expect(typeof call.args[0]).toBe('string');
        expect(typeof call.args[1]).toBe('number');
        expect(call.args[0]).not.toBe(plaintext);
        expect(call.args[0]).not.toBe(encrypted.encryptedData);
        expect(call.args[1]).not.toBe(plaintext);
        expect(call.args[1]).not.toBe(encrypted.encryptedData);
      }
    });

    it('swallows errors thrown by the logger without breaking encrypt/decrypt', () => {
      const throwingLogger: AuditLogger = {
        onEncrypt() { throw new Error('logger-broken'); },
        onDecrypt() { throw new Error('logger-broken'); },
      };
      const crypto = buildCryptoWithAuditLogger(throwingLogger, 1);

      const encrypted = crypto.encrypt('keep-working', EncryptionKey.PII);
      expect(encrypted.keyName).toBe(EncryptionKey.PII);

      const plaintext = crypto.decrypt(encrypted);
      expect(plaintext).toBe('keep-working');
    });

    it('works silently when no auditLogger is configured', () => {
      const crypto = buildTestCrypto(1);

      const encrypted = crypto.encrypt('silent-test', EncryptionKey.PII);
      const plaintext = crypto.decrypt(encrypted);

      expect(plaintext).toBe('silent-test');
    });
  });

  describe('cache behavior', () => {
    it('withCache() fires onDecrypt only on cache miss, not on cache hit', () => {
      const { crypto, calls } = buildCryptoAndLogger(1);

      const cached = crypto.withCache({ ttlMs: 10_000 });
      const encrypted = crypto.encrypt('cached-data', EncryptionKey.PII);
      resetCalls(calls);

      cached.decrypt(encrypted);
      expect(calls).toHaveLength(1);

      cached.decrypt(encrypted);
      expect(calls).toHaveLength(1);
    });
  });

  describe('direct notifier unit tests', () => {
    it('notifyEncrypt is a no-op when auditLogger is undefined', () => {
      expect(() =>
        notifyEncrypt({ auditLogger: undefined, keyName: 'pii', version: 1 }),
      ).not.toThrow();
    });

    it('notifyDecrypt is a no-op when auditLogger is undefined', () => {
      expect(() =>
        notifyDecrypt({ auditLogger: undefined, keyName: 'pii', version: 1 }),
      ).not.toThrow();
    });

    it('notifyEncrypt swallows a throwing logger', () => {
      const throwingLogger: AuditLogger = {
        onEncrypt() { throw new Error('boom'); },
        onDecrypt() { /* noop */ },
      };
      expect(() =>
        notifyEncrypt({ auditLogger: throwingLogger, keyName: 'pii', version: 1 }),
      ).not.toThrow();
    });

    it('notifyDecrypt swallows a throwing logger', () => {
      const throwingLogger: AuditLogger = {
        onEncrypt() { /* noop */ },
        onDecrypt() { throw new Error('boom'); },
      };
      expect(() =>
        notifyDecrypt({ auditLogger: throwingLogger, keyName: 'pii', version: 1 }),
      ).not.toThrow();
    });
  });
});
