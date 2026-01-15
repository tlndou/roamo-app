-- Add canonical_city_id to profiles for deterministic home/away comparison
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS current_canonical_city_id TEXT;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_current_canonical_city_id
ON profiles (current_canonical_city_id);
