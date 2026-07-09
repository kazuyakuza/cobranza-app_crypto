# Project Structure

# Folders in src/

- src/ - library root: main exports, config interfaces, SecureCrypto service, HKDF derivation, and helpers
- src/testing/ - test utilities: SecureCryptoTestModule, getTestCrypto factory, and deterministic test vectors
- src/nestjs/ - NestJS integration helpers: CryptoModule (forRoot/forRootAsync), CryptoService injectable SecureCrypto wrapper, CRYPTO_CONFIG DI token, async config interfaces
- src/utils/ - in-memory TTL cache utility (cache.ts) for optional decryption-result caching; base64/IV/concat helpers remain in src/utils.ts

# Other folders

- .kilo/modes/ - built-in agent mode prompt overrides
- docs/ - documentation files delivered with the library
- tests/ - unit tests (outside src; populated in Phase 2)