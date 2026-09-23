# Authentication & Session Architecture

## 1. Overview

The authentication system is built on zero-trust principles, moving away from prototype local checks to production-grade server-side verification.

```
Client (Login Form)
        │  POST /api/v1/auth/login { email, password }
        ▼
Fastify Auth Route
        │  1. Rate limit check (Redis)
        │  2. Lookup user by email in PostgreSQL
        │  3. Verify Argon2id password hash
        │  4. Check account status ('active', not 'locked')
        │  5. Generate Access Token (JWT 1h) & Refresh Token (7d)
        │  6. Store hashed refresh token in `sessions` table
        ▼
Client Receives JWT & Hydrates Session Store
```

---

## 2. Password Hashing (Argon2id)

All passwords are encrypted using the **Argon2id** algorithm, winner of the Password Hashing Competition (PHC), providing maximum resistance against GPU/ASIC cracking attacks.

- **Algorithm**: `argon2id`
- **Memory Cost**: 65536 KB (64 MB)
- **Time Cost (Iterations)**: 3
- **Parallelism**: 4 threads
- **Salt**: 16 bytes cryptographically secure random bytes

Passwords in transit must use HTTPS. Plaintext passwords are never logged or stored.

---

## 3. Token Strategy & Rotation

1. **Access Token (Short-Lived)**:
   - Lifespan: 1 hour (configurable via `JWT_EXPIRES_IN`).
   - Payload:
     ```json
     {
       "userId": "user-cashier",
       "tenantId": "tenant-abay",
       "role": "cashier",
       "branchId": "loc-bole",
       "exp": 1725480000
     }
     ```
   - Injected in HTTP headers: `Authorization: Bearer <access_token>`.

2. **Refresh Token (Long-Lived & Revocable)**:
   - Lifespan: 7 days (`JWT_REFRESH_EXPIRES_IN`).
   - Hashed using Argon2id and stored in the `sessions` table.
   - Upon refresh, old session token is marked revoked and a new pair is issued (token rotation).

---

## 4. Brute-Force & Account Lockout Policy

To protect against credential stuffing and brute-force attacks:
- `failed_login_attempts` counter increments on failed password verification.
- Upon 5 consecutive failed attempts, `locked_until` is set to `NOW() + INTERVAL '15 minutes'`.
- Rate limiting at the API gateway restricts login requests to 5 attempts per minute per IP address.
