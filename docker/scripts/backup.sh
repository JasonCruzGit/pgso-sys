#!/bin/sh
set -e
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backup/inv_pgp_gso_${TIMESTAMP}.sql.gz"
pg_dump -h postgres -U "${DB_USERNAME}" -d "${DB_DATABASE}" | gzip > "${BACKUP_FILE}"
find /backup -name "*.sql.gz" -mtime +30 -delete
echo "Backup completed: ${BACKUP_FILE}"
