#!/bin/bash
set -e

echo "Restoring database dump from /dump.backup..."
pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" -1 /dump.backup || echo "Restore completed with some warnings."
echo "Restore finished!"
