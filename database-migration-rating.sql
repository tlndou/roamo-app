-- Add rating column to spots table
-- This migration adds support for rating spots (1-5 with 0.5 increments)
-- Rating is only applicable when a spot is marked as visited

ALTER TABLE spots
ADD COLUMN IF NOT EXISTS rating NUMERIC(2, 1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));

-- Add comment to document the column
COMMENT ON COLUMN spots.rating IS 'User rating of the spot (0-5 with 0.5 increments). Only applicable when visited is true.';
