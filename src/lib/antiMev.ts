import { ethers } from 'ethers';
import { TpkePublicKey as PublicKey } from './neox-lib';

// Constants
export const NEO_X_AMEV_RPC = 'https://mainnet-5.rpc.banelabs.org';
export const DKG_CONTRACT_ADDRESS = '0x1212000000000000000000000000000000000002';
// GovReward contract is the recipient of Envelope Transactions
export const GOV_REWARD_CONTRACT_ADDRESS = '0x1212000000000000000000000000000000000003';
export const TPKE_PUBLIC_KEY_HEX = '0xa5aa188d1c60a7173e59fe49b68b969999e70aa4c1acb76c5a3dd2ad0d19a859b1a2759e3995ce1ceccdea5a57fbf637';

const DKG_ABI = [
  'function currentRound() external view returns (uint256)',
];

/**
 * Fetch the current DKG round (epoch).
 */
export async function getDkgRound(providerRpcUrl: string = NEO_X_AMEV_RPC): Promise<number> {
  const provider = new ethers.JsonRpcProvider(providerRpcUrl);
  const dkgContract = new ethers.Contract(DKG_CONTRACT_ADDRESS, DKG_ABI, provider);
  const currentRound = await dkgContract.currentRound();
  return Number(currentRound);
}

/**
 * Encrypts a signed transaction using TPKE.
 */
export function encryptSignedTransaction(signedTx: string): { encryptedKey: Uint8Array; encryptedMsg: Uint8Array } {
  const publicKeyBytes = ethers.getBytes(TPKE_PUBLIC_KEY_HEX);
  const publicKey = PublicKey.fromBytes(publicKeyBytes);
  const msgBytes = ethers.getBytes(signedTx);

  // Encrypt the transaction
  const { encryptedKey, encryptedMsg } = publicKey.encrypt(msgBytes);
  return { encryptedKey, encryptedMsg };
}

/**
 * Constructs the data payload for an Envelope Transaction.
 * Format: prefix(4) | epoch(4-BE) | gaslimit(4-BE) | txHash(32) | encryptedKey | encryptedMsg
 */
export function constructEnvelopeData(
  epoch: number,
  innerTxGasLimit: number,
  innerTxHash: string,
  encryptedKey: Uint8Array,
  encryptedMsg: Uint8Array
): string {
  // 1. Prefix: 0xffffffff
  const prefix = new Uint8Array([0xff, 0xff, 0xff, 0xff]);

  // 2. Epoch: 4 bytes Big Endian
  // ethers.zeroPadValue pads to the left (Big Endian standard for numbers)
  // But we need to ensure it's exactly 4 bytes.
  // Using DataView for precise control over Endianness
  const epochBuffer = new ArrayBuffer(4);
  new DataView(epochBuffer).setUint32(0, epoch, false); // false = Big Endian
  const epochBytes = new Uint8Array(epochBuffer);

  // 3. GasLimit: 4 bytes Big Endian
  const gasLimitBuffer = new ArrayBuffer(4);
  new DataView(gasLimitBuffer).setUint32(0, innerTxGasLimit, false); // false = Big Endian
  const gasLimitBytes = new Uint8Array(gasLimitBuffer);

  // 4. Inner Tx Hash: 32 bytes
  const txHashBytes = ethers.getBytes(innerTxHash);

  // Concatenate all parts
  const envelopeData = ethers.concat([
    prefix,
    epochBytes,
    gasLimitBytes,
    txHashBytes,
    encryptedKey,
    encryptedMsg
  ]);

  return ethers.hexlify(envelopeData);
}

/**
 * Full helper to prepare an Envelope Transaction.
 */
export async function prepareEnvelopeTransaction(
  signer: ethers.Signer,
  innerTx: ethers.TransactionRequest,
  innerTxGasLimit: number = 500000
): Promise<ethers.TransactionRequest> {
  // 1. Get Epoch
  const epoch = await getDkgRound();

  // 2. Prepare Inner Tx (populate nonce, chainId, etc)
  const populatedTx = await signer.populateTransaction(innerTx);

  // Ensure gas vars are set for inner tx simulation/validity if needed, 
  // but for the envelope payload we use the signed raw tx.
  // We need to sign this inner transaction.
  // But wait, the inner transaction nonce must match the envelope transaction nonce.
  // The user steps say:
  // "The nonce must be identical to that of the inner secret transactions."

  if (!populatedTx.nonce) {
    const nonce = await signer.getNonce('pending');
    populatedTx.nonce = nonce;
  }

  // Sign the inner transaction
  // ethers v6: signer.signTransaction(populatedTx)
  const signedInnerTx = await signer.signTransaction(populatedTx);
  const innerTxHash = ethers.keccak256(signedInnerTx);

  // 3. Encrypt
  const { encryptedKey, encryptedMsg } = encryptSignedTransaction(signedInnerTx);

  // 4. Construct Payload
  const data = constructEnvelopeData(epoch, innerTxGasLimit, innerTxHash, encryptedKey, encryptedMsg);

  // 5. Construct Envelope Tx
  const envelopeTx: ethers.TransactionRequest = {
    to: GOV_REWARD_CONTRACT_ADDRESS,
    from: await signer.getAddress(),
    data: data,
    value: 0, // Envelopes usually don't carry value to the GovContract itself, unless paying fee? 
    // The dock says "The gas tip must exceed the network's minGasTipCap plus envelopeFee".
    // Paying execution GAS is handled via the fallback.
    nonce: populatedTx.nonce, // MUST MATCH INNER NONCE
    gasLimit: BigInt(innerTxGasLimit) + 200000n, // Envelope overhead
    type: 0 // Legacy or EIP-1559? Neo X supports both.
  };

  return envelopeTx;
}
