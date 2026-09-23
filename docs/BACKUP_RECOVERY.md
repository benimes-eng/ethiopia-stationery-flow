# Database Backup, Disaster Recovery & High Availability

## 1. Objectives

- **Recovery Point Objective (RPO)**: Maximum acceptable data loss is 15 minutes.
- **Recovery Time Objective (RTO)**: Maximum acceptable downtime for full restoration is 1 hour.

---

## 2. Backup Strategy

1. **Daily Full Logical Backups (`pg_dump`)**:
   - Automated cron job executing nightly at 02:00 EAT (Addis Ababa time).
   - Compressed via gzip and encrypted using AES-256 (`gpg`).
   - Replicated off-site to secure object storage (e.g. AWS S3 in `af-south-1`).
   - Retained for 30 daily, 12 monthly, and 10 annual retention cycles.

2. **Continuous WAL Archiving (Point-in-Time Recovery)**:
   - PostgreSQL Write-Ahead Logs (WAL) streamed continuously to an archive bucket, enabling restoration to any exact second within the last 7 days.

---

## 3. Standard Backup Script

```bash
#!/bin/bash
# scripts/backup-postgres.sh
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/postgres"
FILENAME="$BACKUP_DIR/abay_db_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR
pg_dump -U postgres -d abay_stationery_db --format=custom --compress=9 > "$FILENAME"

# Encrypt backup
gpg --symmetric --cipher-algo AES256 --batch --passphrase "$BACKUP_ENCRYPTION_KEY" "$FILENAME"
rm "$FILENAME"

echo "Backup completed: $FILENAME.gpg"
```

---

## 4. Restoration Procedure

1. Provision or clean target PostgreSQL database instance.
2. Ensure extensions are installed (`backend/src/db/init.sql`).
3. Decrypt and restore dump:
   ```bash
   gpg --decrypt backup_file.sql.gz.gpg | pg_restore -U postgres -d abay_stationery_db --clean --if-exists
   ```
4. Verify record counts for `products`, `inventory_balances`, and `sales`.
5. Start backend application and verify `/ready` health probe returns `200 OK`.
