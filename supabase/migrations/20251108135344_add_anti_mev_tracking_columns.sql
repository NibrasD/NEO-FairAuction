/*
  # Add Anti-MEV tracking columns to bids table

  1. New Columns Added to `bids` table
    - `cached_tx_hash` (text) - Hash of the cached transaction in Anti-MEV RPC pool
    - `cached_tx_nonce` (bigint) - Transaction nonce captured during Step 1
    - `cached_tx_data` (text) - Full signed transaction data cached in the pool
    - `retrieval_message` (text) - Message formatted for user to sign in Step 2
    - `message_signature` (text) - User's signature used to retrieve cached transaction
    - `step_completed` (smallint) - Tracks progress: 0=not started, 1=cached, 2=signed, 3=envelope submitted
    - `step_1_completed_at` (timestamptz) - Timestamp when transaction was cached
    - `step_2_completed_at` (timestamptz) - Timestamp when message was signed
    - `step_3_completed_at` (timestamptz) - Timestamp when envelope was submitted

  2. Indexes
    - Add composite index on (auction_id, bidder_address, step_completed) for efficient queries

  3. Constraints
    - step_completed must be between 0 and 3

  4. Notes
    - All new columns are nullable to support partial completions
    - This enables recovery if user refreshes during the three-step process
    - Data can be used for analytics and debugging the Anti-MEV flow
*/

DO $$
BEGIN
  -- Add cached_tx_hash column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'cached_tx_hash'
  ) THEN
    ALTER TABLE bids ADD COLUMN cached_tx_hash text;
  END IF;

  -- Add cached_tx_nonce column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'cached_tx_nonce'
  ) THEN
    ALTER TABLE bids ADD COLUMN cached_tx_nonce bigint;
  END IF;

  -- Add cached_tx_data column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'cached_tx_data'
  ) THEN
    ALTER TABLE bids ADD COLUMN cached_tx_data text;
  END IF;

  -- Add retrieval_message column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'retrieval_message'
  ) THEN
    ALTER TABLE bids ADD COLUMN retrieval_message text;
  END IF;

  -- Add message_signature column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'message_signature'
  ) THEN
    ALTER TABLE bids ADD COLUMN message_signature text;
  END IF;

  -- Add step_completed column with default 0
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'step_completed'
  ) THEN
    ALTER TABLE bids ADD COLUMN step_completed smallint DEFAULT 0;
  END IF;

  -- Add step_1_completed_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'step_1_completed_at'
  ) THEN
    ALTER TABLE bids ADD COLUMN step_1_completed_at timestamptz;
  END IF;

  -- Add step_2_completed_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'step_2_completed_at'
  ) THEN
    ALTER TABLE bids ADD COLUMN step_2_completed_at timestamptz;
  END IF;

  -- Add step_3_completed_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'step_3_completed_at'
  ) THEN
    ALTER TABLE bids ADD COLUMN step_3_completed_at timestamptz;
  END IF;

  -- Add check constraint for step_completed
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bids_step_completed_check'
  ) THEN
    ALTER TABLE bids ADD CONSTRAINT bids_step_completed_check 
      CHECK (step_completed >= 0 AND step_completed <= 3);
  END IF;
END $$;

-- Create composite index for efficient queries
CREATE INDEX IF NOT EXISTS idx_bids_auction_bidder_step
  ON bids(auction_id, bidder_address, step_completed);