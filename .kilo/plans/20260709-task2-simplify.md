# Task 2 Code Simplification Plan

## Scope

- `src/audit.ts`
- `src/crypto.service.audit.ts`
- `src/crypto.service.ts`
- `tests/crypto.audit.spec.ts`

## Change 1: Unify `notifyEncrypt` and `notifyDecrypt` in `src/crypto.service.audit.ts`

**Motivation:** The two functions are identical except for the hook method they call. Extract a single generic helper to remove duplication while preserving the public API.

**Proposed implementation:**

1. Add a private (module-level) helper:

   ```ts
   type AuditHook = (keyName: string, version: number) => void;

   function notifyAudit(params: AuditNotifyParams, hook: AuditHook): void {
     const { auditLogger, keyName, version } = params;
     if (!auditLogger) {
       return;
     }
     try {
       hook(keyName, version);
     } catch {
       /* swallow — audit must never break crypto */
     }
   }
   ```

2. Rewrite `notifyEncrypt` and `notifyDecrypt` as thin wrappers:

   ```ts
   export function notifyEncrypt(params: AuditNotifyParams): void {
     notifyAudit(params, (auditLogger) => auditLogger.onEncrypt.bind(auditLogger));
   }
   ```

   Or, more directly:

   ```ts
   export function notifyEncrypt(params: AuditNotifyParams): void {
     notifyAudit(params, (keyName, version) => params.auditLogger!.onEncrypt(keyName, version));
   }
   ```

   Preferred form to avoid non-null assertion inside the callback:

   ```ts
   export function notifyEncrypt(params: AuditNotifyParams): void {
     const { auditLogger } = params;
     notifyAudit(params, (keyName, version) => auditLogger!.onEncrypt(keyName, version));
   }
   ```

   Better: pass the bound method:

   ```ts
   export function notifyEncrypt(params: AuditNotifyParams): void {
     const { auditLogger, keyName, version } = params;
     if (!auditLogger) return;
     notifyAudit(auditLogger.onEncrypt.bind(auditLogger), keyName, version);
   }
   ```

   Final preferred signature:

   ```ts
   type AuditHook = (keyName: string, version: number) => void;

   function notifyAudit(hook: AuditHook, keyName: string, version: number): void {
     try {
       hook(keyName, version);
     } catch {
       /* swallow — audit must never break crypto */
     }
   }

   export function notifyEncrypt(params: AuditNotifyParams): void {
     const { auditLogger, keyName, version } = params;
     if (!auditLogger) return;
     notifyAudit(auditLogger.onEncrypt.bind(auditLogger), keyName, version);
   }

   export function notifyDecrypt(params: AuditNotifyParams): void {
     const { auditLogger, keyName, version } = params;
     if (!auditLogger) return;
     notifyAudit(auditLogger.onDecrypt.bind(auditLogger), keyName, version);
   }
   ```

**Behavior preserved:**
- No-op when `auditLogger` is undefined.
- Errors thrown by the hook are swallowed.
- Public exports and signatures remain unchanged.

## Change 2: Extract test setup helper in `tests/crypto.audit.spec.ts`

**Motivation:** Nearly every test repeats:

```ts
const { logger, calls } = createSpyLogger();
const crypto = buildCryptoWithAuditLogger(logger, 1);
```

and later `calls.length = 0`. A combined helper removes ~15 lines of boilerplate.

**Proposed implementation:**

1. Add after existing helpers:

   ```ts
   function buildCryptoAndLogger(version = 1): { crypto: SecureCrypto; logger: AuditLogger; calls: AuditCall[] } {
     const { logger, calls } = createSpyLogger();
     const crypto = buildCryptoWithAuditLogger(logger, version);
     return { crypto, logger, calls };
   }
   ```

2. Replace repeated setups with `const { crypto, calls } = buildCryptoAndLogger(1);` where `logger` is not needed.

3. Add a helper for reset:

   ```ts
   function resetCalls(calls: AuditCall[]): void {
     calls.length = 0;
   }
   ```

   Replace each `calls.length = 0;` with `resetCalls(calls);` for clarity.

## Change 3: Simplify `AuditCall` and `createSpyLogger`

**Motivation:** `AuditCall` stores both `argCount` and `args`, but `argCount` is always derivable. The `args` array also duplicates `keyName` and `version`. Reduce redundancy.

**Proposed implementation:**

1. Change `AuditCall` to:

   ```ts
   interface AuditCall {
     method: 'onEncrypt' | 'onDecrypt';
     keyName: string;
     version: number;
     args: unknown[];
   }
   ```

2. Update `createSpyLogger`:

   ```ts
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
   ```

3. Update assertions that used `argCount`:

   ```ts
   expect(call.args).toHaveLength(2);
   ```

   instead of `expect(call.argCount).toBe(2);`.

## Change 4: Cache current version in `SecureCrypto.encrypt`

**Motivation:** `this.resolvedConfig.currentVersion` is referenced four times in `encrypt`. A local constant improves readability without adding state.

**Proposed implementation:**

```ts
encrypt(plaintext: string, keyName: EncryptionKey | string): EncryptedValue {
  const currentVersion = this.resolvedConfig.currentVersion;
  const key = this.deriveKey(keyName, currentVersion);
  const encrypted = encryptWithAesGcm({
    plaintext,
    key,
    keyName,
    version: currentVersion,
  });
  notifyEncrypt({ auditLogger: this.auditLogger, keyName, version: currentVersion });
  return encrypted;
}
```

## Verification

- Run the audit test suite: `npm test -- tests/crypto.audit.spec.ts` (or equivalent project command).
- Confirm `src/crypto.service.ts` remains at or below 200 lines.
- Confirm no behavioral changes: all existing assertions pass without modification except those updated in Change 3.
