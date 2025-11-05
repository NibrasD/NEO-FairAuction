import { useState, useEffect } from 'react';
import { Gavel, Wallet } from 'lucide-react';
import { connectWallet } from '../lib/web3';
import { ethers } from 'ethers';

interface HeaderProps {
  onWalletConnect: (provider: ethers.BrowserProvider, address: string) => void;
  connectedAddress: string | null;
}

export function Header({ onWalletConnect, connectedAddress }: HeaderProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const provider = await connectWallet();
      if (provider) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        onWalletConnect(provider, address);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <Gavel className="h-8 w-8 text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Fair Auction House</h1>
              <p className="text-xs text-slate-400">MEV-Resistant Bidding on Neo X</p>
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting || !!connectedAddress}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wallet className="h-5 w-5" />
            <span>
              {connectedAddress
                ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`
                : isConnecting
                ? 'Connecting...'
                : 'Connect Wallet'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
