import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { EncryptionKey } from '../../src/index.js';
import { CryptoModule } from '../../src/nestjs/crypto.module.js';
import { CryptoService } from '../../src/nestjs/crypto.service.js';
import { TEST_CRYPTO_CONFIG } from '../../src/testing/index.js';

/** Stand-in for a consumer-provided injectable dependency (e.g. ConfigService). */
class FakeConfigSource {}

/** Minimal module exporting {@link FakeConfigSource} to exercise `imports`. */
@Module({
  providers: [FakeConfigSource],
  exports: [FakeConfigSource],
})
class FakeConfigModule {}

describe('CryptoModule', () => {
  describe('forRoot', () => {
    it('returns a DynamicModule pointing at CryptoModule and exporting CryptoService', () => {
      const dynamic = CryptoModule.forRoot(TEST_CRYPTO_CONFIG);

      expect(dynamic.module).toBe(CryptoModule);
      expect(dynamic.exports).toContain(CryptoService);
    });

    it('provides a working CryptoService via DI', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CryptoModule.forRoot(TEST_CRYPTO_CONFIG)],
      }).compile();

      const service = moduleRef.get(CryptoService);
      expect(service).toBeInstanceOf(CryptoService);
      const encrypted = service.encrypt('x@x.com', EncryptionKey.PII);
      expect(service.decrypt(encrypted)).toBe('x@x.com');
    });
  });

  describe('forRootAsync', () => {
    it('returns a DynamicModule pointing at CryptoModule and exporting CryptoService', () => {
      const dynamic = CryptoModule.forRootAsync({ useFactory: () => TEST_CRYPTO_CONFIG });

      expect(dynamic.module).toBe(CryptoModule);
      expect(dynamic.exports).toContain(CryptoService);
    });

    it('provides a CryptoService from a sync factory with no inject/imports', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CryptoModule.forRootAsync({ useFactory: () => TEST_CRYPTO_CONFIG })],
      }).compile();

      const service = moduleRef.get(CryptoService);
      expect(service.decrypt(service.encrypt('a@a.com', EncryptionKey.PII))).toBe('a@a.com');
    });

    it('provides a CryptoService from an async factory', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          CryptoModule.forRootAsync({ useFactory: async () => TEST_CRYPTO_CONFIG }),
        ],
      }).compile();

      expect(moduleRef.get(CryptoService)).toBeInstanceOf(CryptoService);
    });

    it('honors the imports option by pulling a dependency from an imported module', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          CryptoModule.forRootAsync({
            imports: [FakeConfigModule],
            inject: [FakeConfigSource],
            useFactory: (_src: FakeConfigSource) => TEST_CRYPTO_CONFIG,
          }),
        ],
      }).compile();

      const service = moduleRef.get(CryptoService);
      const encrypted = service.encrypt('b@b.com', EncryptionKey.PII);
      expect(service.decrypt(encrypted)).toBe('b@b.com');
    });
  });
});
