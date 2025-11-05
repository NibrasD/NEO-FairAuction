import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Auction {
  id: string;
  blockchain_auction_id: number;
  seller_address: string;
  item_name: string;
  description: string;
  starting_bid: string;
  highest_bid: string;
  highest_bidder: string | null;
  end_time: string;
  ended: boolean;
  mev_protected: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  blockchain_auction_id: number;
  bidder_address: string;
  bid_amount: string;
  transaction_hash: string;
  mev_protected: boolean;
  created_at: string;
}
