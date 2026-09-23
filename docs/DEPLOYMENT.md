# Production Deployment & Infrastructure Guide

## 1. Quick Start with Docker Compose

The fastest way to launch the complete stack (PostgreSQL 16, Redis 7, Fastify Backend API):

```bash
# 1. Clone repository and configure environment
cp .env.example .env

# 2. Start containers in detached mode
docker compose up -d

# 3. Verify health probes
curl http://localhost:4000/ready
# Output: {"status":"ready","database":"connected",...}
```

---

## 2. Production Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.abaystationery.et;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.abaystationery.et;

    ssl_certificate /etc/letsencrypt/live/api.abaystationery.et/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.abaystationery.et/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 3. Production Readiness Checklist

- [ ] `NODE_ENV=production` set in environment.
- [ ] Strong, random 32+ character secrets generated for `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- [ ] Default PostgreSQL password changed from `postgres_dev_password`.
- [ ] `ENABLE_DEMO_RESET=false` set to prevent accidental database resets in production.
- [ ] Automated backup cron job verified and tested (`/docs/BACKUP_RECOVERY.md`).
- [ ] SSL certificates configured via Let's Encrypt / Certbot.
