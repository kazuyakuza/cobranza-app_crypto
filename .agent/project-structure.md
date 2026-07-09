# Project Structure

# Folders in src/

- src/ - library root: main exports, config interfaces, SecureCrypto facade, HKDF derivation, helpers, mixins (encryption/hashing/keys/validation/guards, facade entry guards crypto.service.facade-guards.ts, bulk object-operations mixin crypto.service.bulk.ts, bulk field guards crypto.service.bulk-guards.ts, audit notifier crypto.service.audit.ts), and AuditLogger interface (audit.ts)
- src/testing/ - test utilities: SecureCryptoTestModule, getTestCrypto factory, and deterministic test vectors
- src/nestjs/ - NestJS integration helpers: CryptoModule (forRoot/forRootAsync), CryptoService injectable SecureCrypto wrapper, CRYPTO_CONFIG DI token, async config interfaces
- src/utils/ - in-memory TTL cache utility (cache.ts) and SecureCrypto-aware decryption cache wrapper (decryption-cache.ts); base64/IV/concat helpers remain in src/utils.ts

# Other folders

- .kilo/modes/ - built-in agent mode prompt overrides
- docs/ - documentation files delivered with the library
- tests/ - unit tests (outside src; populated in Phase 2)