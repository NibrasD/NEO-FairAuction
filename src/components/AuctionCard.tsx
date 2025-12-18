import { useState, useEffect } from 'react';
import { Clock, Shield, ShieldOff, User, TrendingUp, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { ethers } from 'ethers';
import { Auction, supabase } from '../lib/supabase';
import { getContract, sendMEVProtectedTransaction, createBidCommitment, generateSecret } from '../lib/web3';

interface AuctionCardProps {
  auction: Auction;
  provider: ethers.BrowserProvider | null;
  userAddress: string | null;
  onBidPlaced: () => void;
}

type AuctionPhase = 'commit' | 'reveal' | 'ended' | 'active';

export function AuctionCard({ auction, provider, userAddress, onBidPlaced }: AuctionCardProps) {
  const [bidAmount, setBidAmount] = useState('');
  const [isBidding, setIsBidding] = useState(false);
  const [committedSecret, setCommittedSecret] = useState<string | null>(null);
  const [committedAmount, setCommittedAmount] = useState<string | null>(null);
  const [phase, setPhase] = useState<AuctionPhase>('active');
  const [revealTime, setRevealTime] = useState<Date | null>(null);

  const endTime = new Date(auction.end_time);
  const now = new Date();
  const timeRemaining = endTime.getTime() - now.getTime();
  const isExpired = timeRemaining <= 0 || auction.ended;

  useEffect(() => {
    const updatePhase = async () => {
      if (auction.ended) {
        setPhase('ended');
        return;
      }

      if (auction.mev_protected && provider) {
        try {
          const contract = getContract(provider);
          const blockchainAuction = await contract.getAuction(auction.blockchain_auction_id);

          const auctionEndTime = Number(blockchainAuction[6]) * 1000;
          const auctionRevealTime = Number(blockchainAuction[7]) * 1000;

          console.log(`Auction ${auction.blockchain_auction_id} chain data:`, {
            endTime: new Date(auctionEndTime).toISOString(),
            revealTime: new Date(auctionRevealTime).toISOString(),
            now: new Date().toISOString()
          });

          // Sanity check: Ensure timestamps are valid (> 2024)
          // If contract returns 0, ignore it and fall back to DB time
          if (auctionRevealTime < 1700000000000) {
            console.warn('Invalid reveal time from chain, using fallback logic');
            setPhase(isExpired ? 'ended' : 'commit');
            return;
          }

          const now = Date.now();
          if (now >= auctionRevealTime) {
            setPhase('ended');
          } else if (now >= auctionEndTime) {
            setPhase('reveal');
          } else {
            setPhase('commit');
          }
        } catch (error) {
          console.error('Error fetching auction phase:', error);
          setPhase(isExpired ? 'ended' : 'commit');
        }
      } else {
        setPhase(isExpired ? 'ended' : 'active');
      }
    };

    updatePhase();
    const interval = setInterval(updatePhase, 5000);
    return () => clearInterval(interval);
  }, [auction, provider, isExpired]);

  const formatTime = (ms: number) => {
    if (ms <= 0) return 'Ended';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const formatGAS = (wei: string) => {
    try {
      return parseFloat(ethers.formatEther(wei)).toFixed(4);
    } catch {
      return '0.0000';
    }
  };

  const handleNormalBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      alert('Please enter a valid bid amount');
      return;
    }

    const bidAmountFloat = parseFloat(bidAmount);
    const currentBidFloat = parseFloat(formatGAS(auction.highest_bid !== '0' ? auction.highest_bid : auction.starting_bid));

    if (bidAmountFloat <= currentBidFloat) {
      alert(`Bid must be higher than current bid of ${currentBidFloat} GAS`);
      return;
    }

    setIsBidding(true);
    try {
      const contract = getContract(provider);
      const bidAmountWei = ethers.parseEther(bidAmount);

      const receipt = await sendMEVProtectedTransaction(
        contract,
        'placeBid',
        [auction.blockchain_auction_id],
        bidAmountWei.toString()
      );

      await supabase.from('auctions').update({
        highest_bid: bidAmountWei.toString(),
        highest_bidder: userAddress,
      }).eq('blockchain_auction_id', auction.blockchain_auction_id);

      await supabase.from('bids').insert({
        auction_id: auction.id,
        blockchain_auction_id: auction.blockchain_auction_id,
        bidder_address: userAddress,
        bid_amount: bidAmountWei.toString(),
        transaction_hash: receipt.hash,
        mev_protected: false,
      });

      setBidAmount('');
      onBidPlaced();
      alert('Bid placed successfully! Your bid is now visible to everyone.');
    } catch (error: any) {
      console.error('Error placing bid:', error);
      alert(`Failed to place bid: ${error.message}`);
    } finally {
      setIsBidding(false);
    }
  };

  const handleCommitBid = async (e: React.FormEvent) => {
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
      const contract = getContract(provider);
      const secret = generateSecret();
      const commitment = createBidCommitment(bidAmount, secret, userAddress);
      const bidAmountWei = ethers.parseEther(bidAmount);

      console.log('Creating commitment:', { bidAmount, secret, commitment });

      const receipt = await sendMEVProtectedTransaction(
        contract,
        'commitBid',
        [auction.blockchain_auction_id, commitment],
        bidAmountWei.toString()
      );

      setCommittedSecret(secret);
      setCommittedAmount(bidAmount);
      localStorage.setItem(`bid_secret_${auction.blockchain_auction_id}_${userAddress}`, secret);
      localStorage.setItem(`bid_amount_${auction.blockchain_auction_id}_${userAddress}`, bidAmount);

      alert('Bid committed successfully! Your bid is hidden until the reveal phase. Keep this window open or save your bid details.');
      setBidAmount('');
      onBidPlaced();
    } catch (error: any) {
      console.error('Error committing bid:', error);
      alert(`Failed to commit bid: ${error.message}`);
    } finally {
      setIsBidding(false);
    }
  };

  const handleRevealBid = async () => {
    if (!provider || !userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    const secret = committedSecret || localStorage.getItem(`bid_secret_${auction.blockchain_auction_id}_${userAddress}`);
    const amount = committedAmount || localStorage.getItem(`bid_amount_${auction.blockchain_auction_id}_${userAddress}`);

    if (!secret || !amount) {
      alert('No committed bid found. You must commit a bid during the commit phase first.');
      return;
    }

    setIsBidding(true);
    try {
      const contract = getContract(provider);
      const amountWei = ethers.parseEther(amount);

      console.log('Revealing bid:', { amount, secret });

      const receipt = await sendMEVProtectedTransaction(
        contract,
        'revealBid',
        [auction.blockchain_auction_id, amountWei, secret],
        undefined
      );

      await supabase.from('bids').insert({
        auction_id: auction.id,
        blockchain_auction_id: auction.blockchain_auction_id,
        bidder_address: userAddress,
        bid_amount: amountWei.toString(),
        transaction_hash: receipt.hash,
        mev_protected: true,
      });

      localStorage.removeItem(`bid_secret_${auction.blockchain_auction_id}_${userAddress}`);
      localStorage.removeItem(`bid_amount_${auction.blockchain_auction_id}_${userAddress}`);
      setCommittedSecret(null);
      setCommittedAmount(null);

      alert('Bid revealed successfully!');
      onBidPlaced();
    } catch (error: any) {
      console.error('Error revealing bid:', error);
      alert(`Failed to reveal bid: ${error.message}`);
    } finally {
      setIsBidding(false);
    }
  };

  useEffect(() => {
    if (userAddress && auction.mev_protected) {
      const secret = localStorage.getItem(`bid_secret_${auction.blockchain_auction_id}_${userAddress}`);
      const amount = localStorage.getItem(`bid_amount_${auction.blockchain_auction_id}_${userAddress}`);
      if (secret && amount) {
        setCommittedSecret(secret);
        setCommittedAmount(amount);
      }
    }
  }, [auction.blockchain_auction_id, userAddress, auction.mev_protected]);

  const getPhaseInfo = () => {
    if (phase === 'commit') {
      return {
        title: 'Commit Phase',
        subtitle: 'Submit your hidden bid',
        icon: <Lock className="h-4 w-4" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10'
      };
    } else if (phase === 'reveal') {
      const revealTimeRemaining = revealTime ? revealTime.getTime() - Date.now() : 0;
      return {
        title: 'Reveal Phase',
        subtitle: `${formatTime(revealTimeRemaining)} left to reveal`,
        icon: <Unlock className="h-4 w-4" />,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10'
      };
    } else if (phase === 'ended') {
      return {
        title: 'Ended',
        subtitle: auction.highest_bidder ? 'Auction completed' : 'No bids',
        icon: <Clock className="h-4 w-4" />,
        color: 'text-slate-400',
        bgColor: 'bg-slate-900'
      };
    } else {
      return {
        title: 'Active',
        subtitle: 'Bidding open',
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10'
      };
    }
  };

  const phaseInfo = getPhaseInfo();
  const isOwner = userAddress && userAddress.toLowerCase() === auction.seller_address.toLowerCase();

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">{auction.item_name}</h3>
          <p className="text-sm text-slate-400 line-clamp-2">{auction.description}</p>
        </div>
        <div className="ml-4 flex flex-col space-y-2">
          {auction.mev_protected ? (
            <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-500/10 rounded-full">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">MEV Protected</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 px-2 py-1 bg-orange-500/10 rounded-full">
              <ShieldOff className="h-4 w-4 text-orange-400" />
              <span className="text-xs text-orange-400 font-medium">Standard</span>
            </div>
          )}
          {auction.mev_protected && (
            <div className={`flex items-center space-x-1 px-2 py-1 ${phaseInfo.bgColor} rounded-full`}>
              {phaseInfo.icon}
              <span className={`text-xs ${phaseInfo.color} font-medium`}>{phaseInfo.title}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            {auction.mev_protected && phase === 'commit' ? (
              <EyeOff className="h-4 w-4 text-slate-400" />
            ) : (
              <Eye className="h-4 w-4 text-slate-400" />
            )}
            <span className="text-xs text-slate-400">
              {auction.mev_protected && phase === 'commit' ? 'Starting Bid' : 'Current Bid'}
            </span>
          </div>
          <p className="text-lg font-bold text-white">
            {auction.mev_protected && phase === 'commit'
              ? formatGAS(auction.starting_bid)
              : (auction.highest_bid !== '0' ? formatGAS(auction.highest_bid) : formatGAS(auction.starting_bid))
            } GAS
          </p>
          {auction.mev_protected && phase === 'commit' && (
            <p className="text-xs text-slate-500 mt-1">Bids hidden</p>
          )}
        </div>

        <div className="bg-slate-900 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-400">
              {auction.mev_protected && phase === 'commit' ? 'Commit Time' : 'Time Left'}
            </span>
          </div>
          <p className={`text-lg font-bold ${phase === 'ended' ? 'text-slate-500' : 'text-white'}`}>
            {formatTime(timeRemaining)}
          </p>
        </div>
      </div>

      {auction.highest_bidder && phase !== 'commit' && (
        <div className="flex items-center space-x-2 mb-4 px-3 py-2 bg-slate-900 rounded-lg">
          <User className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-400">Leading:</span>
          <span className="text-xs text-white font-mono">
            {auction.highest_bidder.slice(0, 6)}...{auction.highest_bidder.slice(-4)}
          </span>
        </div>
      )}

      {committedAmount && committedSecret && phase === 'commit' && (
        <div className="mb-4 px-3 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <div className="flex items-center space-x-2 mb-1">
            <Lock className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-blue-400 font-medium">Your Committed Bid</span>
          </div>
          <p className="text-sm text-white font-mono">{committedAmount} GAS (Hidden)</p>
          <p className="text-xs text-slate-400 mt-1">Will be revealed in reveal phase</p>
        </div>
      )}

      {!isOwner && userAddress && auction.mev_protected && phase === 'commit' && !committedSecret && (
        <form onSubmit={handleCommitBid} className="space-y-2">
          <input
            type="number"
            step="0.001"
            min={formatGAS(auction.starting_bid)}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder="Enter bid amount (will be hidden)"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isBidding}
            className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center space-x-2"
          >
            <Lock className="h-4 w-4" />
            <span>{isBidding ? 'Committing...' : 'Commit Bid (Hidden)'}</span>
          </button>
        </form>
      )}

      {!isOwner && userAddress && auction.mev_protected && phase === 'reveal' && committedSecret && (
        <button
          onClick={handleRevealBid}
          disabled={isBidding}
          className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center space-x-2"
        >
          <Unlock className="h-4 w-4" />
          <span>{isBidding ? 'Revealing...' : `Reveal Your Bid (${committedAmount} GAS)`}</span>
        </button>
      )}

      {!isOwner && userAddress && !auction.mev_protected && phase === 'active' && (
        <form onSubmit={handleNormalBid} className="flex space-x-2">
          <input
            type="number"
            step="0.001"
            min={formatGAS(auction.highest_bid !== '0' ? auction.highest_bid : auction.starting_bid)}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder="Enter bid amount (visible)"
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

      {!userAddress && phase !== 'ended' && (
        <div className="text-center py-2 bg-slate-900 rounded-lg">
          <p className="text-sm text-slate-400">Connect wallet to place a bid</p>
        </div>
      )}

      {isOwner && phase !== 'ended' && (
        <div className="text-center py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-400">Your Auction</p>
        </div>
      )}

      {phase === 'ended' && (
        <div className="text-center py-2 bg-slate-900 rounded-lg">
          <p className="text-sm text-slate-400">{phaseInfo.subtitle}</p>
        </div>
      )}
    </div>
  );
}
