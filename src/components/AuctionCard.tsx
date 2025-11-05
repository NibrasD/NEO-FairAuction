import { useState } from 'react';
import { Clock, Shield, ShieldOff, User, TrendingUp } from 'lucide-react';
import { ethers } from 'ethers';
import { Auction } from '../lib/supabase';

interface AuctionCardProps {
  auction: Auction;
  provider: ethers.BrowserProvider | null;
  userAddress: string | null;
  onBidPlaced: () => void;
}

export function AuctionCard({ auction, provider, userAddress, onBidPlaced }: AuctionCardProps) {
  const [bidAmount, setBidAmount] = useState('');
  const [isBidding, setIsBidding] = useState(false);

  const endTime = new Date(auction.end_time);
  const now = new Date();
  const timeRemaining = endTime.getTime() - now.getTime();
  const isExpired = timeRemaining <= 0 || auction.ended;

  const formatTime = (ms: number) => {
    if (ms <= 0) return 'Ended';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatGAS = (wei: string) => {
    try {
      return parseFloat(ethers.formatEther(wei)).toFixed(4);
    } catch {
      return '0.0000';
    }
  };

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      alert('Please enter a valid bid amount');
      return;
    }

    setIsBidding(true);
    try {
      alert('Note: Replace CONTRACT_ADDRESS in src/lib/web3.ts with your deployed contract address');
      setBidAmount('');
      onBidPlaced();
    } catch (error) {
      console.error('Error placing bid:', error);
      alert('Failed to place bid. See console for details.');
    } finally {
      setIsBidding(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">{auction.item_name}</h3>
          <p className="text-sm text-slate-400 line-clamp-2">{auction.description}</p>
        </div>
        <div className="ml-4">
          {auction.mev_protected ? (
            <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-500/10 rounded-full">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Protected</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 px-2 py-1 bg-orange-500/10 rounded-full">
              <ShieldOff className="h-4 w-4 text-orange-400" />
              <span className="text-xs text-orange-400 font-medium">Standard</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-400">Current Bid</span>
          </div>
          <p className="text-lg font-bold text-white">
            {auction.highest_bid !== '0' ? formatGAS(auction.highest_bid) : formatGAS(auction.starting_bid)} GAS
          </p>
        </div>

        <div className="bg-slate-900 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-400">Time Left</span>
          </div>
          <p className={`text-lg font-bold ${isExpired ? 'text-slate-500' : 'text-white'}`}>
            {formatTime(timeRemaining)}
          </p>
        </div>
      </div>

      {auction.highest_bidder && (
        <div className="flex items-center space-x-2 mb-4 px-3 py-2 bg-slate-900 rounded-lg">
          <User className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-400">Leading:</span>
          <span className="text-xs text-white font-mono">
            {auction.highest_bidder.slice(0, 6)}...{auction.highest_bidder.slice(-4)}
          </span>
        </div>
      )}

      {!isExpired && userAddress && userAddress.toLowerCase() !== auction.seller_address.toLowerCase() && (
        <form onSubmit={handleBid} className="flex space-x-2">
          <input
            type="number"
            step="0.001"
            min={formatGAS(auction.highest_bid !== '0' ? auction.highest_bid : auction.starting_bid)}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder="Enter bid amount"
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={isBidding}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isBidding ? 'Bidding...' : 'Place Bid'}
          </button>
        </form>
      )}

      {isExpired && (
        <div className="text-center py-2 bg-slate-900 rounded-lg">
          <p className="text-sm text-slate-400">
            {auction.highest_bidder ? 'Auction Ended' : 'No bids placed'}
          </p>
        </div>
      )}
    </div>
  );
}
