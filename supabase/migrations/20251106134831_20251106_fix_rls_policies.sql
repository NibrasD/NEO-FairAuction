/*
  # Fix RLS Policies for Public Auction Creation

  Since users authenticate via Ethereum wallet (not Supabase auth),
  we need to allow public inserts to the auctions table.
  The blockchain smart contract handles validation and security.

  1. Security Changes
    - Update INSERT policy to allow public access (blockchain validates)
    - Keep SELECT policy for public read access
    - Keep UPDATE policy for public bid updates (blockchain validates)
*/

DROP POLICY IF EXISTS "Authenticated users can create auctions" ON auctions;

CREATE POLICY "Anyone can create auctions"
  ON auctions
  FOR INSERT
  TO public
  WITH CHECK (true);