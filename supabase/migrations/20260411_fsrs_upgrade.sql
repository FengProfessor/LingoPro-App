-- FSRS v5 Upgrade Migration
-- Add columns to support the new DSR (Difficulty, Stability, Retrievability) model

ALTER TABLE srs_progress 
ADD COLUMN IF NOT EXISTS stability float8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS difficulty float8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS state int4 DEFAULT 0; -- 0:New, 1:Learning, 2:Review, 3:Relearning

COMMENT ON COLUMN srs_progress.state IS 'FSRS States: 0=New, 1=Learning, 2=Review, 3=Relearning';

-- Optional: Add a version marker
ALTER TABLE srs_progress 
ADD COLUMN IF NOT EXISTS algorithm_version text DEFAULT 'sm2';

-- Initialize existing records
-- We can set stability based on current interval if we want to preserve progress
UPDATE srs_progress 
SET stability = interval_days,
    difficulty = 5 -- Moderate default
WHERE stability = 0;
