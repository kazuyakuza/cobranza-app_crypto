# Project Structure

# Folders in src/

- src/ - library root: main exports, config interfaces, SecureCrypto service, HKDF derivation, and helpers
- src/testing/ - test utilities: SecureCryptoTestModule, getTestCrypto factory, and deterministic test vectors
- src/nestjs/ - NestJS integration helpers: CryptoModule (forRoot/forRootAsync), CryptoService injectable SecureCrypto wrapper, CRYPTO_CONFIG DI token, async config interfaces

# Other folders

- .kilo/modes/ - built-in agent mode prompt overrides
- docs/ - documentation files delivered with the library
- tests/ - unit tests (outside src; populated in Phase 2)