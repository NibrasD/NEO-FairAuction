import { useState } from 'react';
import { Plus, Shield, ShieldOff } from 'lucide-react';
import { ethers } from 'ethers';
import { getContract, sendMEVProtectedTransaction } from '../lib/web3';
import { supabase } from '../lib/supabase';

interface CreateAuctionFormProps {
  provider: ethers.BrowserProvider | null;
  onAuctionCreated: () => void;
}

export function CreateAuctionForm({ provider, onAuctionCreated }: CreateAuctionFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    itemName: '',
    description: '',
    startingBid: '',
    duration: '3600',
    mevProtected: true,
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider) {
      alert('Please connect your wallet first');
      return;
    }

    setIsCreating(true);
    try {
      const contract = getContract(provider);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const contractWithSigner = contract.connect(signer);

      const startingBidWei = ethers.parseEther(formData.startingBid);
      const durationSeconds = parseInt(formData.duration);

      console.log('Creating auction with params:', {
        itemName: formData.itemName,
        description: formData.description,
        startingBid: startingBidWei.toString(),
        duration: durationSeconds,
        mevProtected: formData.mevProtected,
      });

      const tx = await contractWithSigner.createAuction(
        formData.itemName,
        formData.description,
        startingBidWei,
        durationSeconds,
        formData.mevProtected
      );

      console.log('Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      const auctionCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'AuctionCreated';
        } catch {
          return false;
        }
      });

      if (auctionCreatedEvent) {
        const parsed = contract.interface.parseLog(auctionCreatedEvent);
        const auctionId = parsed?.args[0].toString();
        const endTime = Math.floor(Date.now() / 1000) + durationSeconds;

        console.log('Inserting auction into database:', {
          blockchain_auction_id: parseInt(auctionId),
          seller_address: signerAddress,
          item_name: formData.itemName,
          description: formData.description,
          starting_bid: startingBidWei.toString(),
          highest_bid: '0',
          end_time: new Date(endTime * 1000).toISOString(),
          mev_protected: formData.mevProtected,
        });

        const { data, error } = await supabase.from('auctions').insert({
          blockchain_auction_id: parseInt(auctionId),
          seller_address: signerAddress,
          item_name: formData.itemName,
          description: formData.description,
          starting_bid: startingBidWei.toString(),
          highest_bid: '0',
          end_time: new Date(endTime * 1000).toISOString(),
          mev_protected: formData.mevProtected,
        });

        if (error) {
          console.error('Database insert error:', error);
          throw new Error(`Failed to save auction to database: ${error.message}`);
        }

        console.log('Auction saved to database:', data);
        onAuctionCreated();
        setIsOpen(false);
        setFormData({
          itemName: '',
          description: '',
          startingBid: '',
          duration: '3600',
          mevProtected: true,
        });
        alert('Auction created successfully!');
      } else {
        throw new Error('AuctionCreated event not found in transaction receipt');
      }
    } catch (error: any) {
      console.error('Error creating auction:', error);

      let errorMessage = 'Unknown error';
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        errorMessage = 'Transaction rejected by user';
      } else if (error.reason) {
        errorMessage = error.reason;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      }

      alert(`Failed to create auction: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
      >
        <Plus className="h-5 w-5" />
        <span>Create New Auction</span>
      </button>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">Create New Auction</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Item Name
          </label>
          <input
            type="text"
            required
            value={formData.itemName}
            onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="e.g., Rare NFT Collection"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Description
          </label>
          <textarea
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Describe your item..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Starting Bid (GAS)
          </label>
          <input
            type="number"
            step="0.001"
            required
            min="0.001"
            value={formData.startingBid}
            onChange={(e) => setFormData({ ...formData, startingBid: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="0.1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Duration
          </label>
          <select
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="3600">1 Hour</option>
            <option value="21600">6 Hours</option>
            <option value="86400">24 Hours</option>
            <option value="259200">3 Days</option>
          </select>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
          <div className="flex items-center space-x-3">
            {formData.mevProtected ? (
              <Shield className="h-5 w-5 text-emerald-400" />
            ) : (
              <ShieldOff className="h-5 w-5 text-orange-400" />
            )}
            <div>
              <p className="text-sm font-medium text-white">MEV Protection</p>
              <p className="text-xs text-slate-400">
                {formData.mevProtected
                  ? 'Bids are protected from front-running'
                  : 'Standard auction (vulnerable to MEV)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, mevProtected: !formData.mevProtected })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.mevProtected ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.mevProtected ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
          </button>
        </div>

        <div className="flex space-x-3">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreating}
            className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Auction'}
          </button>
        </div>
      </form>
    </div>
  );
}
