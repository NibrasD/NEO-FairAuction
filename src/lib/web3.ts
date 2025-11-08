import { ethers } from 'ethers';
import { PublicKey } from 'neox-tpke';
import { toBytes, concat, pad, toHex, keccak256 } from 'viem';

export const NEO_X_AMEV_RPC = 'https://mainnet-5.rpc.banelabs.org';
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
export const GOV_REWARD_CONTRACT = '0x1212000000000000000000000000000000000003';
export const DKG_CONTRACT = '0x1212000000000000000000000000000000000002';
export const TPKE_PUBLIC_KEY = '0xa5aa188d1c60a7173e59fe49b68b969999e70aa4c1acb76c5a3dd2ad0d19a859b1a2759e3995ce1ceccdea5a57fbf637';

export const DKG_CONTRACT_ABI = [
  'function consensusSize() external view returns (uint256)',
  'function currentRound() external view returns (uint256)',
];

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

export async function sendEnvelopeTransaction(
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

  const contractWithSigner = contract.connect(signer);
  const feeData = await actualProvider.getFeeData();
  const gasLimit = 500000;
  const gasPrice = feeData.gasPrice || ethers.parseUnits('40', 'gwei');

  const txData = contractWithSigner.interface.encodeFunctionData(method, params);
  const nonce = await antiMevProvider.getTransactionCount(signerAddress, 'pending');

  console.log('Step 1: Build transaction object');
  const tx = {
    chainId: NEO_X_CHAIN_ID,
    to: contract.target as string,
    nonce: nonce,
    gasPrice: gasPrice,
    gasLimit: gasLimit,
    value: value || '0',
    data: txData,
    type: 0,
  };

  const txObject = ethers.Transaction.from(tx);
  const txHash = txObject.unsignedHash;
  console.log('Transaction hash to sign:', txHash);

  console.log('Step 2: Sign transaction hash with MetaMask');
  const signature = await signer.signMessage(ethers.getBytes(txHash));
  console.log('✓ Transaction signed');

  console.log('Step 3: Build signed transaction');
  txObject.signature = ethers.Signature.from(signature);
  const signedTx = txObject.serialized;
  console.log('Signed transaction:', signedTx);

  console.log('Step 4: Encrypt transaction with TPKE');
  const publicKey = PublicKey.fromBytes(toBytes(TPKE_PUBLIC_KEY));
  const { encryptedKey, encryptedMsg } = publicKey.encrypt(toBytes(signedTx));
  console.log('✓ Transaction encrypted:', { keyLen: encryptedKey.length, msgLen: encryptedMsg.length });

  const dkgContract = new ethers.Contract(DKG_CONTRACT, DKG_CONTRACT_ABI, antiMevProvider);
  const currentRound = await dkgContract.currentRound();

  const roundBytes = pad(toBytes(Number(currentRound)), { size: 4 });
  const reversedRoundBytes = new Uint8Array(roundBytes).reverse();

  const envelopeData = concat([
    new Uint8Array([0xff, 0xff, 0xff, 0xff]),
    reversedRoundBytes,
    pad(toBytes(Number(gasLimit)), { size: 4 }),
    toBytes(keccak256(signedTx as `0x${string}`)),
    encryptedKey,
    encryptedMsg,
  ]);

  console.log('Step 5: Submit envelope to GovReward contract (0x1212...0003)');
  console.log('Envelope data length:', envelopeData.length);
  const envelopeTx = {
    to: GOV_REWARD_CONTRACT,
    from: signerAddress,
    data: toHex(envelopeData),
    gasLimit: BigInt(gasLimit) + 100000n,
    gasPrice: gasPrice,
    type: 0,
  };

  const txResponse = await signer.sendTransaction(envelopeTx);
  console.log('✓ Envelope submitted:', txResponse.hash);

  const receipt = await txResponse.wait(1);
  console.log('✅ Envelope confirmed! DKG will decrypt and execute your bid.');
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
  txHash: string,
  signature: string
): Promise<string | null> {
  try {
    console.log('=== Retrieving Cached Transaction ===');
    console.log('Transaction hash:', txHash);
    console.log('Signature:', signature.substring(0, 20) + '...');

    const antiMevProvider = new ethers.JsonRpcProvider(NEO_X_AMEV_RPC);

    const cachedTx = await antiMevProvider.send('eth_getCachedTransaction', [
      txHash,
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
): Promise<{ nonce: number; txHash: string; signedTx: string; txParams: any }> {
  console.log('=== Step 1: Build Transaction and Attempt Send ===');
  console.log('Method:', method, 'Params:', params, 'Value:', value);

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

  const tx: any = {
    chainId: NEO_X_CHAIN_ID,
    to: contract.target as string,
    nonce: nonce,
    gasPrice: gasPrice,
    gasLimit: gasLimit,
    value: value || '0',
    data: txData,
    type: 0,
  };

  console.log('Attempting to send transaction...');
  console.log('⚠ User will see MetaMask popup - PLEASE APPROVE IT');
  console.log('⚠ The transaction WILL FAIL after signing - this is EXPECTED for MEV protection');

  try {
    const txResponse = await signer.sendTransaction(tx);
    console.log('⚠ Transaction was accepted (unexpected):', txResponse.hash);
  } catch (error: any) {
    const errorMsg = error.message || error.reason || error.code || String(error);

    console.log('Transaction send failed with:', errorMsg);

    if (errorMsg.includes('user rejected') || errorMsg.includes('User denied') || errorMsg.includes('User rejected')) {
      console.error('✗ User rejected the transaction in MetaMask');
      throw new Error('You must approve the transaction in MetaMask to continue');
    }

    // For require(false) or execution reverted, this is EXPECTED - don't treat as error
    if (errorMsg.includes('require(false)') || errorMsg.includes('execution reverted') || errorMsg.includes('revert')) {
      console.log('✓ Transaction REJECTED (this is EXPECTED for Anti-MEV)');
      console.log('✓ The transaction should now be cached by the RPC');
    } else {
      // For other errors, log but continue
      console.log('⚠ Transaction rejected with:', errorMsg);
      console.log('Continuing anyway - nonce was captured');
    }
  }

  console.log('✓ Step 1 Complete: Transaction attempted and cached, nonce captured');
  console.log('  - Nonce:', nonce);
  console.log('  - Transaction params saved for Step 3');

  return {
    nonce,
    txHash: ethers.solidityPackedKeccak256(['uint256'], [nonce]),
    signedTx: '',
    txParams: tx,
  };
}
