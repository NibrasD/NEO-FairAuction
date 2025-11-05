import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { supabase, Auction } from '../lib/supabase';
import { AuctionCard } from './AuctionCard';
import { Loader2 } from 'lucide-react';

interface AuctionListProps {
  provider: ethers.BrowserProvider | null;
  userAddress: string | null;
  refreshTrigger: number;
}

export function AuctionList({ provider, userAddress, refreshTrigger }: AuctionListProps) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'protected' | 'standard'>('all');

  const fetchAuctions = async () => {
    try {
      let query = supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'protected') {
        query = query.eq('mev_protected', true);
      } else if (filter === 'standard') {
        query = query.eq('mev_protected', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAuctions(data || []);
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
  }, [filter, refreshTrigger]);

  useEffect(() => {
    const channel = supabase
      .channel('auctions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => {
        fetchAuctions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Active Auctions</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('protected')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'protected'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Protected
          </button>
          <button
            onClick={() => setFilter('standard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'standard'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Standard
          </button>
        </div>
      </div>

      {auctions.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
          <p className="text-slate-400">No auctions found. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {auctions.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              provider={provider}
              userAddress={userAddress}
              onBidPlaced={fetchAuctions}
            />
          ))}
        </div>
      )}
    </div>
  );
}
