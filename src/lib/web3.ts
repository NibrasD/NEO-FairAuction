import { ethers } from 'ethers';
import {
  encryptTransaction,
  constructEnvelopeData,
  getCachedTransaction,
  NEO_X_AMEV_RPC,
  GOV_REWARD_CONTRACT
} from './antiMev';

export const NEO_X_STANDARD_RPC = 'https://mainnet-1.rpc.banelabs.org';
export const NEO_X_CHAIN_ID = 47763;

export const NEO_X_MAINNET = {
  chainId: '0xba93',
  chainName: 'Neo X Mainnet',
  nativeCurrency: {
    name: 'GAS',
    symbol: 'GAS',
    decimals: 18,
  },
  rpcUrls: [NEO_X_STANDARD_RPC],
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
    console.log('Connected to network:', network.chainId.toString());

    const validChainIds = [BigInt(NEO_X_CHAIN_ID), BigInt(12227332)];

    if (!validChainIds.includes(network.chainId)) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: NEO_X_MAINNET.chainId }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [NEO_X_MAINNET],
            });
          } catch (addError) {
            console.error('Error adding network:', addError);
            alert('Failed to add Neo X network. Please add it manually in MetaMask.');
            return null;
          }
        } else {
          console.error('Error switching network:', switchError);
          alert(`Wrong network! Please switch to Neo X Mainnet (${NEO_X_CHAIN_ID}) in MetaMask.`);
          return null;
        }
      }
    } else {
      // Even if on the right chain, ensure we are using the Standard RPC
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [NEO_X_MAINNET],
        });
      } catch (error) {
        console.log('Network update skipped or rejected', error);
      }
    }

    const newProvider = new ethers.BrowserProvider(window.ethereum);
    return newProvider;
  } catch (error) {
    console.error('Error connecting wallet:', error);
    alert('Error connecting wallet. Please try again.');
    return null;
  }
}

export function getContract(provider: ethers.BrowserProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

/**
 * Switch wallet to the specified network RPC
 */
export async function ensureNetwork(type: 'STANDARD' | 'ANTIMEV'): Promise<void> {
  const targetRPC = type === 'STANDARD' ? NEO_X_STANDARD_RPC : NEO_X_AMEV_RPC;
  const chainConfig = {
    ...NEO_X_MAINNET,
    rpcUrls: [targetRPC],
  };

  try {
    // Force add/switch to update RPC URL even if chainId is the same
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [chainConfig],
    });
  } catch (error) {
    console.error(`Failed to switch to ${type} RPC:`, error);
    throw new Error(`Please switch your wallet network to use ${type === 'STANDARD' ? 'Standard' : 'Anti-MEV'} RPC.`);
  }
}

/**
 * Main function to send an Anti-MEV protected transaction.
 * Follows the correct Neo X envelope flow based on official examples.
 */
export async function sendMEVProtectedTransaction(
  contract: ethers.Contract,
  method: string,
  params: any[],
  value?: string,
  provider?: ethers.BrowserProvider
): Promise<any> {
  console.log('=== Neo X Anti-MEV Envelope Flow ===');

  // Enforce Anti-MEV Network Connection
  await ensureNetwork('ANTIMEV');

  // Re-initialize provider/signer after network switch
  const freshProvider = new ethers.BrowserProvider(window.ethereum);
  const signer = await freshProvider.getSigner();
  const signerAddress = await signer.getAddress();
  const antiMevProvider = new ethers.JsonRpcProvider(NEO_X_AMEV_RPC);

  // Step 1: Get nonce from Anti-MEV RPC
  console.log('Step 1: Getting transaction nonce');
  const nonce = await antiMevProvider.getTransactionCount(signerAddress, 'pending');
  console.log('✓ Nonce:', nonce);

  // Step 2: Build, Sign, and send transaction to Anti-MEV RPC (will be cached, may error - expected)
  console.log('Step 2: Sending transaction to Anti-MEV cache');
  const contractWithSigner = contract.connect(signer);

  // We MUST use sendTransaction because MetaMask doesn't support signTransaction
  // Since we are connected to Anti-MEV RPC, this sends the tx to the cache node
  try {
    const txData = contractWithSigner.interface.encodeFunctionData(method, params);
    const feeData = await antiMevProvider.getFeeData();
    const gasLimit = 500000;

    // Send Transaction (will be broadcast to Anti-MEV node)
    await signer.sendTransaction({
      to: contract.target,
      data: txData,
      value: value,
      nonce: nonce,
      gasLimit: gasLimit,
      gasPrice: feeData.gasPrice || ethers.parseUnits('40', 'gwei'),
    });
    console.log('Transaction sent to Anti-MEV RPC (unexpected success)');
  } catch (error: any) {
    // Expected - transaction should be cached but rejected by Anti-MEV RPC
    console.log('✓ Transaction cached for AntiMEV processing (expected error or cache confirmation)');
  }

  // Step 3: Sign the nonce as a message
  console.log('Step 3: Signing nonce message');
  const signature = await signer.signMessage(nonce.toString());
  console.log('✓ Signature obtained');

  // Step 4: Fetch the cached signed transaction
  console.log('Step 4: Retrieving cached transaction');
  const signedTx = await getCachedTransaction(nonce, signature, NEO_X_AMEV_RPC);

  if (!signedTx) {
    throw new Error('Failed to retrieve cached transaction. The transaction may not have been cached properly.');
  }
  console.log('✓ Cached transaction retrieved');

  // Step 5: Encrypt the transaction
  console.log('Step 5: Encrypting transaction with TPKE');
  const signedTxBytes = ethers.getBytes(signedTx);
  const { encryptedKey, encryptedMsg, roundNumber } = await encryptTransaction(signedTxBytes, NEO_X_AMEV_RPC);
  console.log('✓ Transaction encrypted');

  // Step 6: Construct the envelope
  console.log('Step 6: Creating transaction envelope');
  const innerTxHash = ethers.keccak256(signedTx);
  const envelopeData = constructEnvelopeData(
    roundNumber,
    500000,
    innerTxHash,
    encryptedKey,
    encryptedMsg
  );

  // Step 7: Send the envelope transaction
  console.log('Step 7: Switching to Standard RPC for envelope submission');
  await ensureNetwork('STANDARD');

  // Refresh signer for Standard RPC
  const stdProvider = new ethers.BrowserProvider(window.ethereum);
  const stdSigner = await stdProvider.getSigner();

  // Get fee data from Standard RPC
  const feeData = await stdProvider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits('40', 'gwei');
  const gasLimit = 850000n; // Slightly more for Anti-MEV
  const gasFee = gasPrice * gasLimit;
  const valueWei = value ? BigInt(value) : 0n;
  const totalRequired = valueWei + gasFee;

  // Check balance before sending
  const balance = await stdProvider.getBalance(signerAddress);
  console.log('Fee Calculation (Standard):', {
    bidValue: ethers.formatEther(valueWei),
    estimatedFee: ethers.formatEther(gasFee),
    totalRequired: ethers.formatEther(totalRequired),
    currentBalance: ethers.formatEther(balance)
  });

  if (balance < totalRequired) {
    const missing = totalRequired - balance;
    throw new Error(`Insufficient funds on Standard RPC. You need ${ethers.formatUnits(totalRequired, 18)} GAS (Bid + Fees) but only have ${ethers.formatUnits(balance, 18)} GAS.`);
  }

  const envelopeTx = {
    to: GOV_REWARD_CONTRACT,
    data: envelopeData,
    nonce: nonce,
    gasLimit: gasLimit,
    gasPrice: gasPrice,
    value: valueWei,
  };

  try {
    const txResponse = await stdSigner.sendTransaction(envelopeTx);
    console.log('✓ Envelope submitted to Standard RPC:', txResponse.hash);

    // Step 8: Wait for confirmation
    console.log('Step 8: Waiting for confirmation');
    const receipt = await txResponse.wait(1);
    console.log('✅ Anti-MEV transaction confirmed!', receipt?.hash);
    return receipt;
  } catch (error: any) {
    console.error('Envelope Submission Error:', error);
    let errorMessage = 'Bidding failed.';
    if (error.message.includes('Internal JSON-RPC error') || error.message.includes('insufficient funds')) {
      errorMessage = `Transaction rejected. Balance (${ethers.formatEther(balance)} GAS) may be too low for Bid + Fees, or network switch failed.`;
    } else if (error.message.includes('user rejected')) {
      errorMessage = 'Transaction was cancelled.';
    }
    throw new Error(errorMessage);
  }
}

/**
 * Send a regular (non-MEV-protected) transaction.
 * Simple wrapper that ensures Standard Network connection.
 */
export async function sendRegularTransaction(
  contract: ethers.Contract,
  method: string,
  params: any[],
  value?: string
): Promise<any> {
  await ensureNetwork('STANDARD');

  // Refresh signer after switch
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contractWithSigner = contract.connect(signer);

  const txOptions: any = {};
  if (value) txOptions.value = value;

  console.log('Sending regular transaction via wallet...');
  console.log('Contract address:', contractWithSigner.target);
  console.log('Params:', params);

  const tx = await contractWithSigner[method](...params, txOptions);
  console.log('Transaction sent:', tx.hash);
  const receipt = await tx.wait();
  return receipt;
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
