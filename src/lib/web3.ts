import { ethers } from 'ethers';

export const NEO_X_MAINNET = {
  chainId: '0xba93',
  chainName: 'Neo X Mainnet',
  nativeCurrency: {
    name: 'GAS',
    symbol: 'GAS',
    decimals: 18,
  },
  rpcUrls: ['https://mainnet.neoxscan.io'],
  blockExplorerUrls: ['https://xexplorer.neo.org'],
};

export const CONTRACT_ADDRESS = '0x0E450e769dB21D7d33EE8e36495b229EA7574519';

export const CONTRACT_ABI = [
  'function createAuction(string memory _itemName, string memory _description, uint256 _startingBid, uint256 _duration, bool _mevProtected) external returns (uint256)',
  'function placeBid(uint256 _auctionId) external payable',
  'function endAuction(uint256 _auctionId) external',
  'function getAuction(uint256 _auctionId) external view returns (address seller, string memory itemName, string memory description, uint256 startingBid, uint256 highestBid, address highestBidder, uint256 endTime, bool ended, bool mevProtected)',
  'function withdraw(uint256 _auctionId) external',
  'function auctionCount() external view returns (uint256)',
  'event AuctionCreated(uint256 indexed auctionId, address indexed seller, string itemName, uint256 startingBid, uint256 endTime, bool mevProtected)',
  'event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount, bool mevProtected)',
  'event AuctionEnded(uint256 indexed auctionId, address winner, uint256 amount)',
];

export async function connectWallet(): Promise<ethers.BrowserProvider | null> {
  if (typeof window.ethereum === 'undefined') {
    alert('Please install MetaMask to use this dApp');
    return null;
  }

  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);

    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(NEO_X_MAINNET.chainId)) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: NEO_X_MAINNET.chainId }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [NEO_X_MAINNET],
          });
        } else {
          throw switchError;
        }
      }
    }

    return provider;
  } catch (error) {
    console.error('Error connecting wallet:', error);
    return null;
  }
}

export function getContract(provider: ethers.BrowserProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

export async function sendMEVProtectedTransaction(
  contract: ethers.Contract,
  method: string,
  params: any[],
  value?: string
): Promise<any> {
  const signer = await contract.runner?.provider?.getSigner();
  if (!signer) throw new Error('No signer available');

  const contractWithSigner = contract.connect(signer);
  const tx = await contractWithSigner[method](...params, {
    value: value || 0,
    type: 2,
    maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei'),
    maxFeePerGas: ethers.parseUnits('50', 'gwei'),
  });

  return tx.wait();
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
