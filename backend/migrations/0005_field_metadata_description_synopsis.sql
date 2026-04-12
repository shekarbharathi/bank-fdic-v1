-- Migration 0005: field_metadata — cap description at 1000 chars, add synopsis (200 chars)
-- Safe to run once on Railway Postgres after 0003 (and 0004 if applicable).
-- Edit the UPDATE section at the bottom with your own description / synopsis text, then run the full file
-- or run the DDL block first and the UPDATEs separately.

BEGIN;

-- Was TEXT (unlimited); now VARCHAR(1000). Longer existing values are truncated via LEFT().
ALTER TABLE field_metadata
  ALTER COLUMN description TYPE VARCHAR(1000)
  USING LEFT(COALESCE(description, ''), 1000)::VARCHAR(1000);

ALTER TABLE field_metadata
  ADD COLUMN IF NOT EXISTS synopsis VARCHAR(200);

COMMIT;

-- =============================================================================
-- OPTIONAL DATA (comment block): Edit every $$...$$ string, then remove the
-- opening "/*" and closing "*/" below and run this file again (or paste the
-- inner statements into Railway’s SQL runner). Until then, only the DDL above applies.
-- Dollar-quoting ($$...$$) avoids escaping single quotes in your text.
-- =============================================================================

/*
BEGIN;

UPDATE field_metadata SET description = $$<EDIT: description for cert (max 1000 chars)>$$, synopsis = $$<EDIT: synopsis for cert (max 200 chars)>$$ WHERE field_name = 'cert';
UPDATE field_metadata SET description = $$<EDIT: description for repdte>$$, synopsis = $$<EDIT: synopsis for repdte>$$ WHERE field_name = 'repdte';

UPDATE field_metadata SET description = $$<EDIT: description for asset>$$, synopsis = $$<EDIT: synopsis for asset>$$ WHERE field_name = 'asset';
UPDATE field_metadata SET description = $$<EDIT: description for dep>$$, synopsis = $$<EDIT: synopsis for dep>$$ WHERE field_name = 'dep';
UPDATE field_metadata SET description = $$<EDIT: description for depdom>$$, synopsis = $$<EDIT: synopsis for depdom>$$ WHERE field_name = 'depdom';
UPDATE field_metadata SET description = $$<EDIT: description for eqtot>$$, synopsis = $$<EDIT: synopsis for eqtot>$$ WHERE field_name = 'eqtot';
UPDATE field_metadata SET description = $$<EDIT: description for lnlsnet>$$, synopsis = $$<EDIT: synopsis for lnlsnet>$$ WHERE field_name = 'lnlsnet';
UPDATE field_metadata SET description = $$<EDIT: description for earna>$$, synopsis = $$<EDIT: synopsis for earna>$$ WHERE field_name = 'earna';
UPDATE field_metadata SET description = $$<EDIT: description for ilndom>$$, synopsis = $$<EDIT: synopsis for ilndom>$$ WHERE field_name = 'ilndom';
UPDATE field_metadata SET description = $$<EDIT: description for chbal>$$, synopsis = $$<EDIT: synopsis for chbal>$$ WHERE field_name = 'chbal';

UPDATE field_metadata SET description = $$<EDIT: description for dpmmd>$$, synopsis = $$<EDIT: synopsis for dpmmd>$$ WHERE field_name = 'dpmmd';
UPDATE field_metadata SET description = $$<EDIT: description for dpsav>$$, synopsis = $$<EDIT: synopsis for dpsav>$$ WHERE field_name = 'dpsav';
UPDATE field_metadata SET description = $$<EDIT: description for brttrans>$$, synopsis = $$<EDIT: synopsis for brttrans>$$ WHERE field_name = 'brttrans';
UPDATE field_metadata SET description = $$<EDIT: description for p2215>$$, synopsis = $$<EDIT: synopsis for p2215>$$ WHERE field_name = 'p2215';

UPDATE field_metadata SET description = $$<EDIT: description for lncrcd>$$, synopsis = $$<EDIT: synopsis for lncrcd>$$ WHERE field_name = 'lncrcd';
UPDATE field_metadata SET description = $$<EDIT: description for lnre>$$, synopsis = $$<EDIT: synopsis for lnre>$$ WHERE field_name = 'lnre';
UPDATE field_metadata SET description = $$<EDIT: description for lnci>$$, synopsis = $$<EDIT: synopsis for lnci>$$ WHERE field_name = 'lnci';
UPDATE field_metadata SET description = $$<EDIT: description for lnresre>$$, synopsis = $$<EDIT: synopsis for lnresre>$$ WHERE field_name = 'lnresre';

UPDATE field_metadata SET description = $$<EDIT: description for intinc>$$, synopsis = $$<EDIT: synopsis for intinc>$$ WHERE field_name = 'intinc';
UPDATE field_metadata SET description = $$<EDIT: description for intexp>$$, synopsis = $$<EDIT: synopsis for intexp>$$ WHERE field_name = 'intexp';
UPDATE field_metadata SET description = $$<EDIT: description for nonii>$$, synopsis = $$<EDIT: synopsis for nonii>$$ WHERE field_name = 'nonii';
UPDATE field_metadata SET description = $$<EDIT: description for nonix>$$, synopsis = $$<EDIT: synopsis for nonix>$$ WHERE field_name = 'nonix';
UPDATE field_metadata SET description = $$<EDIT: description for netinc>$$, synopsis = $$<EDIT: synopsis for netinc>$$ WHERE field_name = 'netinc';
UPDATE field_metadata SET description = $$<EDIT: description for sc>$$, synopsis = $$<EDIT: synopsis for sc>$$ WHERE field_name = 'sc';

UPDATE field_metadata SET description = $$<EDIT: description for roa>$$, synopsis = $$<EDIT: synopsis for roa>$$ WHERE field_name = 'roa';
UPDATE field_metadata SET description = $$<EDIT: description for roaptx>$$, synopsis = $$<EDIT: synopsis for roaptx>$$ WHERE field_name = 'roaptx';
UPDATE field_metadata SET description = $$<EDIT: description for nimy>$$, synopsis = $$<EDIT: synopsis for nimy>$$ WHERE field_name = 'nimy';

UPDATE field_metadata SET description = $$<EDIT: description for elnatr>$$, synopsis = $$<EDIT: synopsis for elnatr>$$ WHERE field_name = 'elnatr';
UPDATE field_metadata SET description = $$<EDIT: description for eq>$$, synopsis = $$<EDIT: synopsis for eq>$$ WHERE field_name = 'eq';
UPDATE field_metadata SET description = $$<EDIT: description for rbct>$$, synopsis = $$<EDIT: synopsis for rbct>$$ WHERE field_name = 'rbct';
UPDATE field_metadata SET description = $$<EDIT: description for rbcrwaj>$$, synopsis = $$<EDIT: synopsis for rbcrwaj>$$ WHERE field_name = 'rbcrwaj';
UPDATE field_metadata SET description = $$<EDIT: description for lnatres>$$, synopsis = $$<EDIT: synopsis for lnatres>$$ WHERE field_name = 'lnatres';

UPDATE field_metadata SET description = $$<EDIT: description for numemp>$$, synopsis = $$<EDIT: synopsis for numemp>$$ WHERE field_name = 'numemp';
UPDATE field_metadata SET description = $$<EDIT: description for offdom>$$, synopsis = $$<EDIT: synopsis for offdom>$$ WHERE field_name = 'offdom';

COMMIT;
*/
