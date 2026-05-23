#!/bin/sh
# ============================================================
# EduMaster - Auto Backup Script
# Cháº¡y tá»± Ä‘á»™ng má»—i ngÃ y lÃºc 2:00 AM
# Giá»¯ láº¡i tá»‘i Ä‘a 7 báº£n backup gáº§n nháº¥t
# ============================================================

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="edumaster_backup_${TIMESTAMP}.sql"
KEEP_DAYS=7

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ===== Báº¯t Ä‘áº§u backup ====="

# Táº¡o thÆ° má»¥c náº¿u chÆ°a cÃ³
mkdir -p "$BACKUP_DIR"

# Dump database
pg_dump \
  -h "$DATABASE_HOST" \
  -p "$DATABASE_PORT" \
  -U "$DATABASE_USERNAME" \
  -d "$DATABASE_NAME" \
  --no-password \
  -F p \
  -f "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
  SIZE=$(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] âœ… Backup thÃ nh cÃ´ng: $FILENAME ($SIZE)"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] âŒ Backup THáº¤T Báº I!"
  exit 1
fi

# XÃ³a cÃ¡c báº£n backup cÅ© hÆ¡n KEEP_DAYS ngÃ y
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ðŸ—‘ï¸  Dá»n backup cÅ© hÆ¡n ${KEEP_DAYS} ngÃ y..."
find "$BACKUP_DIR" -name "edumaster_backup_*.sql" -mtime +${KEEP_DAYS} -delete

# Liá»‡t kÃª cÃ¡c báº£n backup hiá»‡n cÃ³
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ðŸ“ Danh sÃ¡ch backup hiá»‡n cÃ³:"
ls -lh "$BACKUP_DIR"/edumaster_backup_*.sql 2>/dev/null | awk '{print "   " $NF " - " $5}'

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ===== HoÃ n thÃ nh ====="
