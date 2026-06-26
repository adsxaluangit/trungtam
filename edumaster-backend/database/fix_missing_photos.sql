-- ============================================================
-- Fix: Vá ảnh 3x4 bị thiếu cho các records cùng CCCD (trong 5 năm)
-- Chạy 1 lần trong PostgreSQL admin / psql
-- ============================================================

-- Bước 1: Xem trước số records sẽ được cập nhật
SELECT COUNT(*) AS se_cap_nhat
FROM students AS target
WHERE target.photo IS NULL
  AND target.id_number IS NOT NULL
  AND target.id_number <> ''
  AND target.created_at >= NOW() - INTERVAL '5 years'
  AND EXISTS (
    SELECT 1 FROM students AS s2
    WHERE s2.id_number = target.id_number
      AND s2.photo IS NOT NULL AND s2.photo <> ''
      AND s2.created_at >= NOW() - INTERVAL '5 years'
      AND s2.id <> target.id
  );

-- Bước 2: Thực hiện cập nhật (URL cũ — KHÔNG tạo file mới trên ổ cứng)
UPDATE students AS target
SET photo = (
    SELECT source.photo
    FROM students AS source
    WHERE source.id_number = target.id_number
      AND source.photo IS NOT NULL AND source.photo <> ''
      AND source.created_at >= NOW() - INTERVAL '5 years'
      AND source.id <> target.id
    ORDER BY source.created_at DESC
    LIMIT 1
)
WHERE target.photo IS NULL
  AND target.id_number IS NOT NULL
  AND target.id_number <> ''
  AND target.created_at >= NOW() - INTERVAL '5 years'
  AND EXISTS (
    SELECT 1 FROM students AS s2
    WHERE s2.id_number = target.id_number
      AND s2.photo IS NOT NULL AND s2.photo <> ''
      AND s2.created_at >= NOW() - INTERVAL '5 years'
      AND s2.id <> target.id
  );

-- Bước 3: Kiểm tra kết quả sau khi chạy
SELECT
  COUNT(*) FILTER (WHERE photo IS NOT NULL AND photo <> '') AS co_anh,
  COUNT(*) FILTER (WHERE photo IS NULL OR photo = '')       AS khong_anh,
  COUNT(*)                                                  AS tong_records_5nam
FROM students
WHERE created_at >= NOW() - INTERVAL '5 years';
