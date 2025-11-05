/*
  # Create Auctions Table

  1. New Tables
    - `auctions`
      - `id` (uuid, primary key)
      - `blockchain_auction_id` (bigint, unique) - ID from smart contract
      - `seller_address` (text) - Ethereum address of seller
      - `item_name` (text) - Name of item being auctioned
      - `description` (text) - Detailed description
      - `starting_bid` (text) - Starting bid in wei (stored as string)
      - `highest_bid` (text) - Current highest bid in wei
      - `highest_bidder` (text) - Address of highest bidder
      - `end_time` (timestamptz) - Auction end time
      - `ended` (boolean) - Whether auction has ended
      - `mev_protected` (boolean) - Whether auction uses MEV protection
      - `created_at` (timestamptz) - Record creation time
      - `updated_at` (timestamptz) - Last update time

  2. Security
    - Enable RLS on `auctions` table
    - Add policy for public read access (auctions are public)
    - Add policy for authenticated users to create auctions
*/

CREATE TABLE IF NOT EXISTS auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blockchain_auction_id bigint UNIQUE NOT NULL,
  seller_address text NOT NULL,
  item_name text NOT NULL,
  description text NOT NULL,
  starting_bid text NOT NULL,
  highest_bid text DEFAULT '0',
  highest_bidder text,
  end_time timestamptz NOT NULL,
  ended boolean DEFAULT false,
  mev_protected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view auctions"
  ON auctions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create auctions"
  ON auctions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update auction bids"
  ON auctions
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_auctions_blockchain_id ON auctions(blockchain_auction_id);
CREATE INDEX IF NOT EXISTS idx_auctions_ended ON auctions(ended);
CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time);
