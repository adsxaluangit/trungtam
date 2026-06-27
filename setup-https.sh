#!/bin/bash
# =================================================================
# Script cai dat HTTPS bang DNS Challenge cho trungtam.mic1.edu.vn
# =================================================================

DOMAIN="trungtam.mic1.edu.vn"
EMAIL="${1:-admin@mic1.edu.vn}"

echo ""
echo "======================================================"
echo "  Cai dat HTTPS (DNS Challenge) cho $DOMAIN"
echo "  Email: $EMAIL"
echo "======================================================"
echo ""
echo "Phuong phap: DNS-01 Challenge"
echo "  - Khong can port 80"
echo "  - Chi can port 443"
echo "  - Can them 1 TXT record vao DNS panel cua mic1.edu.vn"
echo ""

# BUOC 1: Lay chung chi bang DNS Challenge
echo "======================================================"
echo " BUOC 1: Lay chung chi SSL"
echo "======================================================"
echo ""
echo "Tiep theo Certbot se hoi ban them TXT record vao DNS."
echo "Hay san sang mo DNS panel cua $DOMAIN."
echo ""
read -p "Nhan Enter de bat dau..."

docker compose run --rm certbot certonly \
  --manual \
  --preferred-challenges dns \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

if [ $? -ne 0 ]; then
    echo ""
    echo "THAT BAI! Kiem tra lai:"
    echo "  1. Da them TXT record dung chua?"
    echo "  2. Record da propagate chua? (doi 1-5 phut)"
    exit 1
fi

echo ""
echo "OK! Lay cert thanh cong!"

# BUOC 2: Khoi dong nginx-proxy voi HTTPS
echo ""
echo "======================================================"
echo " BUOC 2: Khoi dong Nginx Proxy va tat ca services"
echo "======================================================"
docker compose up -d nginx-proxy

echo ""
echo "======================================================"
echo " HOAN THANH!"
echo " Tu gio ban co the truy cap vao trang web qua: https://$DOMAIN"
echo "======================================================"
echo ""
