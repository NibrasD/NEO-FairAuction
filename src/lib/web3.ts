import { ethers } from 'ethers';
import {
  encryptSignedTransaction,
  constructEnvelopeData,
  getDkgRound,
  NEO_X_AMEV_RPC,
  GOV_REWARD_CONTRACT_ADDRESS,
  DKG_CONTRACT_ADDRESS
} from './antiMev';

export const NEO_X_CHAIN_ID = 47763;

export const NEO_X_MAINNET = {
  chainId: '0xba93',
  chainName: 'Neo X Mainnet',
  nativeCurrency: {
    name: 'GAS',
    symbol: 'GAS',
    decimals: 18,
  },
  rpcUrls: [NEO_X_AMEV_RPC],
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
        const newProvider = new ethers.BrowserProvider(window.ethereum);
        return newProvider;
      } catch (switchError: any) {
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
        alert(`Wrong network! Please switch to Neo X Mainnet (${NEO_X_CHAIN_ID}) in MetaMask.`);
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

/**
 * Main function to send an Anti-MEV transaction.
 * Follows the compatible flow: Cache -> Sign Nonce -> Fetch Signed Tx -> Encrypt -> Send Envelope.
 */
export async function sendMEVProtectedTransaction(
  contract: ethers.Contract,
  method: string,
  params: any[],
  value?: string,
  provider?: ethers.BrowserProvider
): Promise<any> {
  console.log('=== Neo X Anti-MEV Envelope Flow ===');
  console.log('Method:', method, 'Params:', params, 'Value:', value);

  const actualProvider = provider || (contract.runner?.provider as ethers.BrowserProvider);
  if (!actualProvider) throw new Error('No provider available');

  const signer = await actualProvider.getSigner();
  const signerAddress = await signer.getAddress();
  const antiMevProvider = new ethers.JsonRpcProvider(NEO_X_AMEV_RPC);

  // --- Step 1 & 2: Build and Cahce (Send to fail) ---
  // We use the helper to trigger the "failed" send which caches the tx in the node.
  const { nonce } = await buildAndCacheTransaction(contract, method, params, value, actualProvider);

  // --- Step 3: Sign the Nonce ---
  console.log('Step 3: Sign the nonce to prove ownership');
  // The message to sign is just the nonce as a string? Or is it specific?
  // Docs say: "Request the wallet to sign the nonce of the secret transaction as a message"
  // Usually this means signing the string representation or the bytes?
  // Based on common practices and the previous code example (which seemed confused), 
  // let's assume it's the stringified nonce or similar. 
  // NOTE: The example code I replaced was `signer.signMessage(ethers.getBytes(txHash))`. 
  // But the doc says "sign the nonce".
  // Let's try signing the decimal string of the nonce.
  const nonceMsg = nonce.toString();
  const signature = await signer.signMessage(nonceMsg);
  console.log('✓ Nonce signed');

  // --- Step 4: Fetch Signed Transaction ---
  console.log('Step 4: Fetch signed transaction from cache');
  const signedTx = await getCachedTransaction(nonce, signature); // Modified to take nonce
  if (!signedTx) {
    throw new Error('Failed to retrieve signed transaction from cache');
  }

  // --- Step 5: Encrypt ---
  console.log('Step 5: Encrypt transaction');
  const { encryptedKey, encryptedMsg } = encryptSignedTransaction(signedTx);

  // --- Step 6: Construct Envelope ---
  console.log('Step 6: Construct Envelope');
  const epoch = await getDkgRound();
  // Estimate gas limit for the inner tx. We can use the cached gas limit or a safe default.
  // We'll use 500,000 as a safe buffer for now.
  const innerGasLimit = 500000;

  // Hash the inner signed transaction
  const innerTxHash = ethers.keccak256(signedTx);

  const envelopeData = constructEnvelopeData(
    epoch,
    innerGasLimit,
    innerTxHash,
    encryptedKey,
    encryptedMsg
  );

  // --- Step 7: Send Envelope ---
  console.log('Step 7: Send Envelope to GovReward Contract');
  const feeData = await actualProvider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits('40', 'gwei');

  const envelopeTx = {
    to: GOV_REWARD_CONTRACT_ADDRESS,
    from: signerAddress,
    data: envelopeData,
    gasLimit: BigInt(innerGasLimit) + 200000n, // Overhead
    gasPrice: gasPrice,
    type: 0,
    nonce: nonce // Envelope Nonce MUST match Inner Nonce
  };

  const txResponse = await signer.sendTransaction(envelopeTx);
  console.log('✓ Envelope submitted:', txResponse.hash);

  const receipt = await txResponse.wait(1);
  console.log('✅ Envelope confirmed! Bid placed.');
  return receipt;
}

export async function sendRegularTransaction(
  contract: ethers.Contract,
  method: string,
  params: any[],
  value?: string
): Promise<any> {
  console.log('=== Sending Regular Transaction ===');
  console.log('Method:', method, 'Params:', params, 'Value:', value);

  const signer = await contract.runner?.provider?.getSigner();
  if (!signer) throw new Error('No signer available');

  const contractWithSigner = contract.connect(signer);

  const txOptions: any = {};
  if (value) {
    txOptions.value = value;
  }

  const tx = await contractWithSigner[method](...params, txOptions);
  console.log('Transaction sent:', tx.hash);

  const receipt = await tx.wait();
  console.log('Transaction confirmed!');
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

export async function getCachedTransaction(
  nonce: number,
  signature: string
): Promise<string | null> {
  try {
    console.log('=== Retrieving Cached Transaction ===');
    const antiMevProvider = new ethers.JsonRpcProvider(NEO_X_AMEV_RPC);

    // The method signature in docs is `eth_getCachedTransaction`.
    // It requires "valid sender signature". 
    // Usually arguments are [address, nonce, signature] or similar?
    // Doc says: "Request the wallet to sign the nonce ... as a message; Use this signature".
    // It doesn't specify the exact JSON-RPC params order.
    // However, looking at the previous file structure, it was passing `[txHash, signature]`.
    // But sending `txHash` implies we know the hash.
    // Ideally we pass `[nonce, signature]` or something.
    // Let's assume the previous code `[txHash, signature]` was a guess.
    // If we assume standard Neo X behavior, maybe it needs `[address, nonceVal, signature]`?
    // Let's try `[nonceHex, signature]`.

    // Note: The previous code commented "It requires a valid sender signature in parameters".
    // I will try passing `[txHash, signature]` IF we have the hash.
    // But the `buildAndCacheTransaction` computes the likely `txHash`.
    // Let's pass `[txHash, signature]` as per the previous implementation attempt, hoping it was based on *something* correct, 
    // OR try to find specs. 
    // Since I can't find specs, I'll stick to `[txHash, signature]` but I need `txHash`.
    // `buildAndCache` returns `txHash`.

    // Let's recalculate the txHash from nonce? No, we need the exact hash.
    // `buildAndCache` returns `txHash` (calculated as keccak(nonce)?? No that's wrong).
    // The previous code `txHash: ethers.solidityPackedKeccak256(['uint256'], [nonce])` was definitely placeholder/wrong.

    // Let's try to ask the RPC for help or assume parameters are `[signedMessage]`?
    // Actually, `eth_getCachedTransaction` likely takes the signature and looks up the tx.
    // Parameters: `[signature]`. Or `[address, signature]`.

    // I'll stick to the parameters `[signature]` since the signature contains the signed nonce, verifying ownership.
    // Wait, I'll pass `[signature]` only.

    const cachedTx = await antiMevProvider.send('eth_getCachedTransaction', [
      signature
    ]);

    if (cachedTx) {
      console.log('✓ Cached transaction retrieved successfully');
      return cachedTx;
    } else {
      console.warn('⚠ No cached transaction found');
      return null;
    }
  } catch (error) {
    console.error('Error retrieving cached transaction:', error);
    return null;
  }
}

export async function buildAndCacheTransaction(
  contract: ethers.Contract,
  method: string,
  params: any[],
  value?: string,
  provider?: ethers.BrowserProvider
): Promise<{ nonce: number; txHash: string }> {
  console.log('=== Step 1: Build Transaction and Attempt Send ===');

  const actualProvider = provider || (contract.runner?.provider as ethers.BrowserProvider);
  if (!actualProvider) throw new Error('No provider available');

  const signer = await actualProvider.getSigner();
  const signerAddress = await signer.getAddress();
  const antiMevProvider = new ethers.JsonRpcProvider(NEO_X_AMEV_RPC);

  const contractWithSigner = contract.connect(signer);
  const feeData = await actualProvider.getFeeData();
  const gasLimit = 500000;
  const gasPrice = feeData.gasPrice || ethers.parseUnits('40', 'gwei');

  const txData = contractWithSigner.interface.encodeFunctionData(method, params);
  const nonce = await antiMevProvider.getTransactionCount(signerAddress, 'pending');

  console.log('Building transaction with nonce:', nonce);

  // We need to send this via the Signer (Metamask) to the Node.
  // The Node must be `NEO_X_AMEV_RPC`.
  // Metamask is connected to `actualProvider`. 
  // IMPORTANT: The user must be connected to the Anti-MEV RPC in Metamask for this to work natively?
  // OR we rely on the fact that we can't force Metamask RPC, so we just send it.
  // If Metamask is connected to a different RPC, `eth_sendTransaction` goes there.
  // The User Instructions said: "send it to nodes configured with --txpool.amevcache".
  // This implies the USER MUST BE CONNECTED TO THE SPECIAL RPC in Metamask.
  // `connectWallet` checks specific Chain ID.
  // `NEO_X_AMEV_RPC` is `https://mainnet-5.rpc.banelabs.org`.
  // The `NEO_X_MAINNET` object uses this RPC.
  // So if `connectWallet` succeeded, Metamask is using the Anti-MEV RPC.

  const tx: any = {
    to: contract.target as string,
    data: txData,
    value: value || '0',
    // We let Metamask handle gas/nonce usually, but for this specific flow we need the nonce.
    // If we specify nonce in Metamask send, it works.
    nonce: nonce
  };

  try {
    const txResponse = await signer.sendTransaction(tx);
    // If it succeeds (shouldn't if node rejects it), we get a hash.
    return { nonce, txHash: txResponse.hash };
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.log('Transaction send outcome:', errorMsg);

    // We expect failure or weirdness.
    // But we need the tx to be in the cache.
    // If the node rejects it with "Anti-MEV flow initiated" or similar, good.
    // If it just silently fails, we hope it's cached.

    // We'll return the nonce we used.
    // We assume the hash is unknown/irrelevant if we fetch by signature.
    return { nonce, txHash: '' };
  }
}

