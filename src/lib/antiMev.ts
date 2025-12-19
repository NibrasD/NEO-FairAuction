import { ethers } from 'ethers';
import { TpkePublicKey } from './neox-lib';

// Neo X Mainnet Contract Addresses
export const NEO_X_AMEV_RPC = 'https://mainnet-5.rpc.banelabs.org';
export const GOVERNANCE_CONTRACT = '0x1212000000000000000000000000000000000001';
export const GOV_REWARD_CONTRACT = '0x1212000000000000000000000000000000000003';
export const KEY_MANAGEMENT_CONTRACT = '0x1212000000000000000000000000000000000008';

// Contract ABIs (minimal required functions)
const GOVERNANCE_ABI = [
  'function consensusSize() external view returns (uint256)'
];

const KEY_MANAGEMENT_ABI = [
  'function roundNumber() external view returns (uint256)',
  'function aggregatedCommitments(uint256 round) external view returns (bytes)'
];

/**
 * Get the consensus size from the Governance contract.
 */
export async function getConsensusSize(providerRpcUrl: string = NEO_X_AMEV_RPC): Promise<number> {
  const provider = new ethers.JsonRpcProvider(providerRpcUrl);
  const contract = new ethers.Contract(GOVERNANCE_CONTRACT, GOVERNANCE_ABI, provider);
  const size = await contract.consensusSize();
  return Number(size);
}

/**
 * Get the current round number from the KeyManagement contract.
 */
export async function getRoundNumber(providerRpcUrl: string = NEO_X_AMEV_RPC): Promise<number> {
  const provider = new ethers.JsonRpcProvider(providerRpcUrl);
  const contract = new ethers.Contract(KEY_MANAGEMENT_CONTRACT, KEY_MANAGEMENT_ABI, provider);
  const round = await contract.roundNumber();
  return Number(round);
}

/**
 * Get the aggregated commitment for a specific round.
 */
export async function getAggregatedCommitment(
  round: number,
  providerRpcUrl: string = NEO_X_AMEV_RPC
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(providerRpcUrl);
  const contract = new ethers.Contract(KEY_MANAGEMENT_CONTRACT, KEY_MANAGEMENT_ABI, provider);
  const commitment = await contract.aggregatedCommitments(round);
  return commitment;
}

/**
 * Calculate the threshold from consensus size.
 * Formula: ceil(2 * n / 3)
 */
export function calculateThreshold(consensusSize: number): number {
  return Math.ceil((2 * consensusSize) / 3);
}

/**
 * Encrypts a signed transaction using TPKE with the aggregated commitment.
 */
export async function encryptTransaction(
  txBytes: Uint8Array,
  providerRpcUrl: string = NEO_X_AMEV_RPC
): Promise<{ encryptedKey: Uint8Array; encryptedMsg: Uint8Array; roundNumber: number }> {
  console.log('--- Encrypting Transaction ---');
  // Get TPKE parameters from contracts
  const consensusSize = await getConsensusSize(providerRpcUrl);
  const roundNumber = await getRoundNumber(providerRpcUrl);
  const aggregatedCommitment = await getAggregatedCommitment(roundNumber, providerRpcUrl);

  // Simulate DKG round info structure for logging purposes
  const roundInfo = {
    consensus_size: consensusSize,
    round_number: roundNumber,
    threshold: calculateThreshold(consensusSize),
    public_key: aggregatedCommitment, // Using aggregatedCommitment as public_key for TPKE
  };

  console.log('DKG Round Info:', JSON.stringify(roundInfo));

  if (!roundInfo || !roundInfo.public_key) {
    throw new Error('Could not retrieve Anti-MEV public key from node');
  }

  const commitmentHex = roundInfo.public_key.startsWith('0x') ? roundInfo.public_key.slice(2) : roundInfo.public_key;
  const commitment = ethers.getBytes('0x' + commitmentHex);
  console.log('Commitment bytes length:', commitment.length);
  console.log('Commitment hex (first 20 bytes):', commitmentHex.slice(0, 40));

  // Create public key from aggregated commitment
  const tpk = TpkePublicKey.fromAggregatedCommitment(
    commitment,
    roundInfo.consensus_size,
    roundInfo.threshold
  );

  // Encrypt the transaction
  const { encryptedKey, encryptedMsg } = tpk.encrypt(txBytes);

  return { encryptedKey, encryptedMsg, roundNumber };
}

/**
 * Constructs the envelope data payload.
 * Format: prefix(4) | round(4-BE) | gaslimit(4-BE) | txHash(32) | encryptedKey | encryptedMsg
 */
export function constructEnvelopeData(
  roundNumber: number,
  innerTxGasLimit: number,
  innerTxHash: string,
  encryptedKey: Uint8Array,
  encryptedMsg: Uint8Array
): string {
  // 1. Prefix: 0xffffffff
  const prefix = new Uint8Array([0xff, 0xff, 0xff, 0xff]);

  // 2. Round number: 4 bytes Big Endian
  const roundBuffer = new ArrayBuffer(4);
  new DataView(roundBuffer).setUint32(0, roundNumber, false); // false = Big Endian
  const roundBytes = new Uint8Array(roundBuffer);

  // 3. GasLimit: 4 bytes Big Endian
  const gasLimitBuffer = new ArrayBuffer(4);
  new DataView(gasLimitBuffer).setUint32(0, innerTxGasLimit, false);
  const gasLimitBytes = new Uint8Array(gasLimitBuffer);

  // 4. Inner Tx Hash: 32 bytes
  const txHashBytes = ethers.getBytes(innerTxHash);

  // Concatenate all parts
  const envelopeData = ethers.concat([
    prefix,
    roundBytes,
    gasLimitBytes,
    txHashBytes,
    encryptedKey,
    encryptedMsg
  ]);

  return ethers.hexlify(envelopeData);
}

/**
 * Get cached transaction from the Anti-MEV RPC.
 */
export async function getCachedTransaction(
  nonce: number,
  signature: string,
  providerRpcUrl: string = NEO_X_AMEV_RPC
): Promise<string | null> {
  const provider = new ethers.JsonRpcProvider(providerRpcUrl);

  // Convert nonce to hex (strict format: 0x0 NOT 0x00)
  const nonceHex = '0x' + nonce.toString(16);

  console.log('Fetching cached transaction:', { nonceHex, signature });

  try {
    // Retry loop to handle potential indexing delays
    for (let i = 0; i < 5; i++) {
      const cachedTx = await provider.send('eth_getCachedTransaction', [nonceHex, signature]);

      if (cachedTx) {
        console.log('Cached transaction retrieved:', 'success', 'Attempts:', i + 1);
        return cachedTx;
      }

      console.log(`Attempt ${i + 1}: Cached transaction not found yet, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.warn('Failed to retrieve cached transaction after retries');
    return null;
  } catch (error) {
    console.error('Error fetching cached transaction:', error);
    return null;
  }
}
