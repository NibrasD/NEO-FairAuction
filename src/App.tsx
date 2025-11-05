import { useState } from 'react';
import { ethers } from 'ethers';
import { Header } from './components/Header';
import { CreateAuctionForm } from './components/CreateAuctionForm';
import { AuctionList } from './components/AuctionList';
import { ComparisonPanel } from './components/ComparisonPanel';

function App() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleWalletConnect = (newProvider: ethers.BrowserProvider, address: string) => {
    setProvider(newProvider);
    setUserAddress(address);
  };

  const handleAuctionCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header onWalletConnect={handleWalletConnect} connectedAddress={userAddress} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <ComparisonPanel />
        </div>

        <div className="mb-8">
          <CreateAuctionForm provider={provider} onAuctionCreated={handleAuctionCreated} />
        </div>

        <AuctionList
          provider={provider}
          userAddress={userAddress}
          refreshTrigger={refreshTrigger}
        />
      </main>

      <footer className="border-t border-slate-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-slate-400 text-sm">
            Built for Neo X GrantShares GS-004 - MEV Resistance Demo
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
