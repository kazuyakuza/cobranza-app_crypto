import 'reflect-metadata';

import { EncryptionKey } from '../../src/index.js';
import { SecureCrypto } from '../../src/crypto.service.js';
import { CryptoService } from '../../src/nestjs/crypto.service.js';
import { TEST_CRYPTO_CONFIG } from '../../src/testing/index.js';

describe('CryptoService', () => {
  it('is a SecureCrypto subclass', () => {
    const service = new CryptoService(TEST_CRYPTO_CONFIG);

    expect(service).toBeInstanceOf(SecureCrypto);
    expect(service).toBeInstanceOf(CryptoService);
  });

  it('encrypts and decrypts via inherited SecureCrypto methods', () => {
    const service = new CryptoService(TEST_CRYPTO_CONFIG);
    const encrypted = service.encrypt('user@example.com', EncryptionKey.PII);

    expect(service.decrypt(encrypted)).toBe('user@example.com');
  });

  it('hashes and verifies via inherited methods', () => {
    const service = new CryptoService(TEST_CRYPTO_CONFIG);
    const hash = service.hash('user@example.com');

    expect(service.verifyHash('user@example.com', hash)).toBe(true);
  });

  it('encryptAndHash returns both encrypted payload and hash', () => {
    const service = new CryptoService(TEST_CRYPTO_CONFIG);
    const { encrypted, hash } = service.encryptAndHash('user@example.com', EncryptionKey.PII);

    expect(service.decrypt(encrypted)).toBe('user@example.com');
    expect(service.verifyHash('user@example.com', hash)).toBe(true);
  });

  it('destroy clears internal state without throwing', () => {
    const service = new CryptoService(TEST_CRYPTO_CONFIG);
    service.encrypt('warm-up', EncryptionKey.PII);

    expect(() => service.destroy()).not.toThrow();
  });
});
