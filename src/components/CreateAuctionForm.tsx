import { useState } from 'react';
import { Plus, Shield, ShieldOff } from 'lucide-react';
import { ethers } from 'ethers';

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
      alert('Note: Replace CONTRACT_ADDRESS in src/lib/web3.ts with your deployed contract address');
      setIsOpen(false);
      setFormData({
        itemName: '',
        description: '',
        startingBid: '',
        duration: '3600',
        mevProtected: true,
      });
    } catch (error) {
      console.error('Error creating auction:', error);
      alert('Failed to create auction. See console for details.');
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
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.mevProtected ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.mevProtected ? 'translate-x-6' : 'translate-x-1'
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
