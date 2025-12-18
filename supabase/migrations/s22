/*
  # Add revealed column to bids table

  1. Changes
    - Add `revealed` column (boolean) to track if bid has been revealed
    - Default value is false
    - Update policy to allow anyone to update revealed status

  2. Security
    - Add policy for anyone to update revealed status
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'revealed'
  ) THEN
    ALTER TABLE bids ADD COLUMN revealed boolean DEFAULT false;
  END IF;
END $$;

CREATE POLICY "Anyone can update bid revealed status"
  ON bids
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
