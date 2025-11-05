/*
  # Create Bids Table

  1. New Tables
    - `bids`
      - `id` (uuid, primary key)
      - `auction_id` (uuid, foreign key to auctions)
      - `blockchain_auction_id` (bigint) - Reference to smart contract auction ID
      - `bidder_address` (text) - Ethereum address of bidder
      - `bid_amount` (text) - Bid amount in wei (stored as string)
      - `transaction_hash` (text) - Blockchain transaction hash
      - `mev_protected` (boolean) - Whether bid used MEV protection
      - `created_at` (timestamptz) - Bid timestamp

  2. Security
    - Enable RLS on `bids` table
    - Add policy for public read access (bids are public)
    - Add policy for anyone to insert bids (on-chain validation)
*/

CREATE TABLE IF NOT EXISTS bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid REFERENCES auctions(id) ON DELETE CASCADE,
  blockchain_auction_id bigint NOT NULL,
  bidder_address text NOT NULL,
  bid_amount text NOT NULL,
  transaction_hash text NOT NULL,
  mev_protected boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bids"
  ON bids
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert bids"
  ON bids
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_blockchain_auction_id ON bids(blockchain_auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at DESC);
