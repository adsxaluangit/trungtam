#!/bin/sh
# ============================================================
# EduMaster - Cron Entrypoint
# Thiáº¿t láº­p cron job vÃ  cháº¡y backup service
# ============================================================

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ðŸš€ Khá»Ÿi Ä‘á»™ng Backup Service..."
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ðŸ“… Lá»‹ch backup: Má»—i ngÃ y lÃºc 02:00 AM"

# Truyá»n biáº¿n mÃ´i trÆ°á»ng vÃ o cron environment
printenv | grep -E "DATABASE_|PGPASSWORD" > /etc/environment

# Táº¡o cron job: backup lÃºc 2:00 AM má»—i ngÃ y
echo "0 2 * * * . /etc/environment; /backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

# Cháº¡y backup ngay láº§n Ä‘áº§u khi khá»Ÿi Ä‘á»™ng
echo "[$(date '+%Y-%m-%d %H:%M:%S')] âš¡ Cháº¡y backup láº§n Ä‘áº§u ngay bÃ¢y giá»..."
/backup.sh

# Khá»Ÿi Ä‘á»™ng cron daemon
echo "[$(date '+%Y-%m-%d %H:%M:%S')] âœ… Cron daemon Ä‘ang cháº¡y - backup tiáº¿p theo lÃºc 02:00 AM"
crond -f -l 2
