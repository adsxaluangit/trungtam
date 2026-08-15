BEGIN;

-- Create a temporary table to map duplicate IDs to the primary ID
CREATE TEMP TABLE doc_mapping AS
SELECT 
    id AS duplicate_id,
    FIRST_VALUE(id) OVER (PARTITION BY id_number, name ORDER BY id ASC) AS primary_id
FROM student_documents
WHERE id_number IS NOT NULL AND id_number != '';

-- Update the links to point to the primary_id
UPDATE student_documents_student_lnk lnk
SET student_document_id = map.primary_id
FROM doc_mapping map
WHERE lnk.student_document_id = map.duplicate_id
  AND map.duplicate_id != map.primary_id;

-- Delete the duplicates from student_documents
DELETE FROM student_documents sd
USING doc_mapping map
WHERE sd.id = map.duplicate_id
  AND map.duplicate_id != map.primary_id;

COMMIT;
