import { ethers } from 'ethers';

export const NEO_X_MAINNET = {
  chainId: '0xba93',
  chainName: 'Neo X Mainnet',
  nativeCurrency: {
    name: 'GAS',
    symbol: 'GAS',
    decimals: 18,
  },
  rpcUrls: ['https://mainnet-1.rpc.banelabs.org'],
  blockExplorerUrls: ['https://xexplorer.neo.org'],
};

export const CONTRACT_ADDRESS = '0x3256e67769bac151A2b23F15115ADB04462ea797';

export const CONTRACT_ABI = [
  'function createAuction(string memory _itemName, string memory _description, uint256 _startingBid, uint256 _duration, bool _mevProtected) external returns (uint256)',
  'function placeBid(uint256 _auctionId) external payable',
  'function commitBid(uint256 _auctionId, bytes32 _commitment) external payable',
  'function revealBid(uint256 _auctionId, uint256 _amount, string memory _secret) external',
  'function endAuction(uint256 _auctionId) external',
  'function getAuction(uint256 _auctionId) external view returns (address seller, string memory itemName, string memory description, uint256 startingBid, uint256 highestBid, address highestBidder, uint256 endTime, uint256 revealTime, bool ended, bool mevProtected)',
  'function getCommitment(uint256 _auctionId, address _bidder) external view returns (bytes32 commitment, uint256 deposit, bool revealed)',
  'function withdraw(uint256 _auctionId) external',
  'function auctionCount() external view returns (uint256)',
  'event AuctionCreated(uint256 indexed auctionId, address indexed seller, string itemName, uint256 startingBid, uint256 endTime, uint256 revealTime, bool mevProtected)',
  'event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount, bool mevProtected)',
  'event BidCommitted(uint256 indexed auctionId, address indexed bidder, bytes32 commitment)',
  'event BidRevealed(uint256 indexed auctionId, address indexed bidder, uint256 amount)',
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
    console.log('Connected to network:', network.chainId.toString(), '(0x' + network.chainId.toString(16) + ')');

    // Accept Neo X Mainnet (47763) and Neo X TestNet (12227332)
    const validChainIds = [BigInt(47763), BigInt(12227332)];

    if (!validChainIds.includes(network.chainId)) {
      try {
        // Try to switch to Neo X Mainnet automatically
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: NEO_X_MAINNET.chainId }],
        });
        // Reload provider after switch
        const newProvider = new ethers.BrowserProvider(window.ethereum);
        return newProvider;
      } catch (switchError: any) {
        // If the chain hasn't been added to MetaMask, add it
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [NEO_X_MAINNET],
            });
            const newProvider = new ethers.BrowserProvider(window.ethereum);
            return newProvider;
          } catch (addError) {
            console.error('Error adding network:', addError);
            alert('Failed to add Neo X network. Please add it manually in MetaMask.');
            return null;
          }
        }
        console.error('Error switching network:', switchError);
        alert(`Wrong network! Current Chain ID: ${network.chainId}. Please switch to Neo X Mainnet (47763) in MetaMask.`);
        return null;
      }
    }

    return provider;
  } catch (error) {
    console.error('Error connecting wallet:', error);
    alert('Error connecting wallet. Please try again.');
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

  const txOptions: any = {};

  if (value) {
    txOptions.value = value;
  }

  try {
    const gasEstimate = await contractWithSigner[method].estimateGas(...params, txOptions);
    console.log('Gas estimate:', gasEstimate.toString());
    txOptions.gasLimit = gasEstimate * 120n / 100n;
  } catch (error: any) {
    console.error('Gas estimation failed:', error);
    throw new Error('Transaction would fail: ' + (error.reason || error.message));
  }

  const feeData = await signer.provider.getFeeData();
  console.log('Fee data:', {
    gasPrice: feeData.gasPrice?.toString(),
    maxFeePerGas: feeData.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
  });

  txOptions.type = 0;
  if (feeData.gasPrice) {
    txOptions.gasPrice = feeData.gasPrice;
  } else {
    txOptions.gasPrice = ethers.parseUnits('20', 'gwei');
  }

  console.log('Sending transaction with options:', txOptions);
  const tx = await contractWithSigner[method](...params, txOptions);
  console.log('Transaction sent:', tx.hash);

  return tx.wait();
}

export function createBidCommitment(amount: string, secret: string, bidderAddress: string): string {
  const amountWei = ethers.parseEther(amount);
  const hash = ethers.solidityPackedKeccak256(
    ['uint256', 'string', 'address'],
    [amountWei, secret, bidderAddress]
  );
  return hash;
}

export function generateSecret(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
