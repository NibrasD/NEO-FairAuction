import { bls12_381 } from '@noble/curves/bls12-381.js';
import { sha256 } from '@noble/hashes/sha2.js';
import aesjs from 'aes-js';

// Helper to convert bytes to bigint for scalar multiplication
function bytesToBigInt(bytes: Uint8Array): bigint {
    return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class Ciphertext {
    constructor(
        public cMsg: any, // G1 Point
        public bigR: any, // G1 Point
        public commitment: any // G2 Point
    ) { }

    toBytes(): Uint8Array {
        // Standard compressed serialization for BLS12-381
        // G1 compressed = 48 bytes
        // G2 compressed = 96 bytes
        // Total = 192 bytes
        const b1 = this.cMsg.toRawBytes(true);
        const b2 = this.bigR.toRawBytes(true);
        const b3 = this.commitment.toRawBytes(true);

        const out = new Uint8Array(b1.length + b2.length + b3.length);
        out.set(b1, 0);
        out.set(b2, b1.length);
        out.set(b3, b1.length + b2.length);
        return out;
    }
}

export class TpkePublicKey {
    private pg1: any; // G1 Point

    constructor(pg1: any) {
        this.pg1 = pg1;
    }

    /**
     * Create a TPKE public key from raw bytes (compressed G1 point).
     */
    static fromBytes(bytes: Uint8Array): TpkePublicKey {
        const hexString = bytesToHex(bytes);
        const point = bls12_381.G1.ProjectivePoint.fromHex(hexString);
        return new TpkePublicKey(point);
    }

    /**
     * Create a TPKE public key from an aggregated commitment.
     * The aggregated commitment contains the public key as the first G1 point.
     * 
     * Format of aggregatedCommitment (from Neo X KeyManagement):
     * - First 96 bytes: G1 point (uncompressed) for the public key
     * - Rest: additional commitment data
     * 
     * Based on the working example, we extract the G1 public key.
     */
    static fromAggregatedCommitment(
        commitment: Uint8Array,
        _consensusSize: number,
        _threshold: number
    ): TpkePublicKey {
        // The aggregated commitment format from Neo X:
        // The first part contains the aggregated public key
        // Based on BLS12-381, G1 points can be 48 bytes (compressed) or 96 bytes (uncompressed)

        // From the example, the commitment is 128 bytes, which suggests:
        // 2 x 64 bytes = 128 bytes (padded coordinates)
        // Or it could be a specific format

        // Looking at the testnet example commitment (128 bytes after 0x prefix removal):
        // We need to extract the G1 public key from this

        // The Neo X TPKE library uses a specific format
        // Let's try to extract the first 96 bytes as the G1 point (uncompressed with padding)

        console.log('Aggregated commitment length:', commitment.length);

        // Try extracting as compressed G1 (48 bytes) - common format
        if (commitment.length >= 48) {
            try {
                // First try: first 48 bytes as compressed G1
                const g1Bytes = commitment.slice(0, 48);
                const hexString = bytesToHex(g1Bytes);
                const point = bls12_381.G1.ProjectivePoint.fromHex(hexString);
                console.log('Created TPKE public key from first 48 bytes');
                return new TpkePublicKey(point);
            } catch (e) {
                console.log('Failed to parse first 48 bytes as G1, trying alternate format');
            }
        }

        // Alternative: The commitment might have a different structure
        // From the example, it's 128 bytes which could be: 
        // [32-byte padding][48-byte G1 compressed][rest...]
        // Or [64-byte Fp element][64-byte Fp element]

        if (commitment.length >= 96) {
            try {
                // Skip first 32 bytes (might be padding), take next 48
                const g1Bytes = commitment.slice(32, 80);
                const hexString = bytesToHex(g1Bytes);
                const point = bls12_381.G1.ProjectivePoint.fromHex(hexString);
                console.log('Created TPKE public key from bytes 32-80');
                return new TpkePublicKey(point);
            } catch (e) {
                console.log('Failed alternate G1 parsing');
            }
        }

        // If all else fails, try the full commitment as-is
        // This handles cases where the library expects raw format
        const point = bls12_381.G1.ProjectivePoint.fromHex(bytesToHex(commitment));
        return new TpkePublicKey(point);
    }

    encrypt(msg: Uint8Array): { encryptedKey: Uint8Array; encryptedMsg: Uint8Array } {
        // 1. Generate random scalars r1, r2
        const r1Bytes = bls12_381.utils.randomPrivateKey();
        const r1 = bytesToBigInt(r1Bytes);

        const r2Bytes = bls12_381.utils.randomPrivateKey();
        const r2 = bytesToBigInt(r2Bytes);

        // 2. Compute ephemeral points
        // U = G1 * r1
        const U = bls12_381.G1.ProjectivePoint.BASE.multiply(r1);

        // Deriving the AES key from U
        const uBytes = U.toRawBytes(false); // false = uncompressed
        const aesKey = sha256(uBytes); // 32 bytes

        // 3. Compute encryptedKey components (The TPKE Ciphertext "Header")
        // C1 = U + PK * r2 (Blinded Ephemeral Key)
        const pkTimesR2 = this.pg1.multiply(r2);
        const C1 = U.add(pkTimesR2);

        // C2 = G1 * r2
        const C2 = bls12_381.G1.ProjectivePoint.BASE.multiply(r2);

        // C3 = - (G2 * r2)
        const g2R2 = bls12_381.G2.ProjectivePoint.BASE.multiply(r2);
        const C3 = g2R2.negate();

        const cipherText = new Ciphertext(C1, C2, C3);
        const encryptedKey = cipherText.toBytes();

        // 4. AES-CBC Encrypt Message
        const iv = aesKey.slice(0, 16); // Use first 16 bytes of hash as IV

        // aes-js requires input to be multiple of 16 bytes for CBC
        const paddedMsg = aesjs.padding.pkcs7.pad(Array.from(msg));
        const aesCbc = new aesjs.ModeOfOperation.cbc(Array.from(aesKey), Array.from(iv));
        const encryptedMsgArray = aesCbc.encrypt(paddedMsg);
        const encryptedMsg = new Uint8Array(encryptedMsgArray);

        return {
            encryptedKey,
            encryptedMsg
        };
    }
}
