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
  console.log(`Requesting switch to ${type} network (${targetRPC})...`);

  const chainConfig = {
    ...NEO_X_MAINNET,
    chainName: type === 'STANDARD' ? 'Neo X Mainnet' : 'Neo X Anti-MEV', // Differentiate for clarity
    rpcUrls: [targetRPC],
  };

  try {
    // We use addEthereumChain as it's the most reliable way to force an RPC update 
    // when the Chain ID is already in the wallet but the RPC needs to change.
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [chainConfig],
    });
    console.log(`✓ Network switch to ${type} accepted.`);
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error(`Connection to ${type} RPC rejected by user. Please accept the switch in MetaMask.`);
    }
    console.error(`Failed to switch to ${type} RPC:`, error);
    throw new Error(`Failed to switch to ${type} RPC. Please check your MetaMask connection.`);
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
  console.log('--- Phase 1: Network Setup ---');
  await ensureNetwork('ANTIMEV');

  // Re-initialize provider/signer after switch
  const freshProvider = new ethers.BrowserProvider(window.ethereum);
  const signer = await freshProvider.getSigner();
  const signerAddress = await signer.getAddress();
  console.log('✓ Account:', signerAddress);

  // Step 1: Get nonce (must use Standard RPC for accuracy)
  console.log('Step 1: Getting transaction nonce from Standard RPC');
  const stdRpcProvider = new ethers.JsonRpcProvider(NEO_X_STANDARD_RPC);
  const nonce = await stdRpcProvider.getTransactionCount(signerAddress, 'pending');
  console.log('✓ Nonce (pending):', nonce);

  // Balance Check
  const balance = await stdRpcProvider.getBalance(signerAddress);
  console.log('✓ Current Balance:', ethers.formatEther(balance), 'GAS');

  const estimatedCost = ethers.parseUnits('100', 'gwei') * 1000000n; // Conservative estimate
  if (balance < estimatedCost) {
    throw new Error(`Insufficient GAS balance. Required: ~${ethers.formatEther(estimatedCost)} GAS, Available: ${ethers.formatEther(balance)} GAS`);
  }

  // Step 2: Build, Sign, and send transaction to Anti-MEV RPC (will be cached)
  console.log('Step 2: Sending transaction to Anti-MEV cache (RPC 5)');

  // We MUST use sendTransaction because MetaMask doesn't support signTransaction
  try {
    const txData = contract.interface.encodeFunctionData(method, params);
    const feeData = await freshProvider.getFeeData();
    const gasLimit = 500000;

    console.log('Attempting to send transaction to Anti-MEV RPC for caching...');
    await signer.sendTransaction({
      to: contract.target,
      data: txData,
      value: value,
      nonce: nonce,
      gasLimit: gasLimit,
      gasPrice: feeData.gasPrice || ethers.parseUnits('40', 'gwei'),
      type: 0 // Explicitly set to Legacy
    });
    console.log('Transaction sent to Anti-MEV RPC (unexpected success)');
  } catch (error: any) {
    console.log('✓ Transaction cached for AntiMEV processing');
  }

  // Step 3: Sign the nonce as a message
  console.log('--- Phase 2: Authorization ---');
  console.log('Step 3: Signing nonce message:', nonce.toString());
  const signature = await signer.signMessage(nonce.toString());
  console.log('✓ Signature obtained');

  // Step 4: Fetch the cached signed transaction
  console.log('Step 4: Retrieving cached transaction from RPC 5');
  const signedTx = await getCachedTransaction(nonce, signature, NEO_X_AMEV_RPC);

  if (!signedTx) {
    console.error('❌ Failed to retrieve cached transaction from Anti-MEV node');
    throw new Error('Failed to retrieve cached transaction. Please ensure you approved the transaction in MetaMask.');
  }
  console.log('✓ Cached transaction length:', signedTx.length);

  // Step 5: Encrypt the transaction
  console.log('--- Phase 3: Privacy (TPKE Encryption) ---');
  const signedTxBytes = ethers.getBytes(signedTx);
  const { encryptedKey, encryptedMsg, roundNumber } = await encryptTransaction(signedTxBytes, NEO_X_AMEV_RPC);
  console.log('✓ Encryption Successful:', {
    round: roundNumber,
    keySize: encryptedKey.length,
    msgSize: encryptedMsg.length
  });

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
  console.log('✓ Envelope generated (size):', envelopeData.length);

  // Step 7: Final Interaction - Switch to RPC 1
  console.log('Step 7: Switching to Standard RPC (RPC 1) for GovReward submission');
  await ensureNetwork('STANDARD');

  // Re-initialize for Standard RPC
  const stdProvider = new ethers.BrowserProvider(window.ethereum);
  const stdSigner = await stdProvider.getSigner();

  // Use legacy gas price to avoid EIP-1559 issues (eth_maxPriorityFeePerGas errors)
  const feeData = await stdProvider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits('40', 'gwei');
  const gasLimit = 1000000n; // Increased for extra safety
  const valueWei = value ? BigInt(value) : 0n;

  console.log('Submitting envelope to GovReward contract on Standard RPC...');
  console.log('Final Params:', {
    to: GOV_REWARD_CONTRACT,
    gasLimit: gasLimit.toString(),
    gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
    value: ethers.formatEther(valueWei) + ' GAS'
  });

  const envelopeTx = {
    to: GOV_REWARD_CONTRACT,
    data: envelopeData,
    nonce: nonce,
    gasLimit: gasLimit,
    gasPrice: gasPrice, // Force legacy
    value: valueWei,
    type: 0 // Explicitly set to Legacy
  };

  try {
    const txResponse = await stdSigner.sendTransaction(envelopeTx);
    console.log('✓ Envelope submitted to RPC 1:', txResponse.hash);

    // Return early with the response so UI can update immediately
    // The wait(1) will happen in the background or be handled by the caller
    return txResponse;
  } catch (error: any) {
    console.error('Submission Error:', error);
    throw new Error(`Final submission failed: ${error.message}`);
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
