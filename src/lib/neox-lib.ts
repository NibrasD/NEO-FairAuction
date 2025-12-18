import { bls12_381 } from '@noble/curves/bls12-381.js';
import { sha256 } from '@noble/hashes/sha2.js';
import aesjs from 'aes-js';

// Get the generator points from the curve (Note: in noble-curves v1 it's .Point)
const G1 = bls12_381.G1.Point;
const G2 = bls12_381.G2.Point;

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
        // G1 compressed = 48 bytes, G2 compressed = 96 bytes
        const b1 = this.cMsg.toBytes();
        const b2 = this.bigR.toBytes();
        const b3 = this.commitment.toBytes();

        const out = new Uint8Array(b1.length + b2.length + b3.length);
        out.set(b1, 0);
        out.set(b2, b1.length);
        out.set(b3, b1.length + b2.length);
        return out;
    }
}

export class TpkePublicKey {
    private pg1: any;

    constructor(pg1: any) {
        this.pg1 = pg1;
    }

    static fromBytes(bytes: Uint8Array): TpkePublicKey {
        const hexString = bytesToHex(bytes);
        const point = G1.fromHex(hexString);
        return new TpkePublicKey(point);
    }

    /**
     * Create a TPKE public key from an aggregated commitment.
     */
    static fromAggregatedCommitment(
        commitment: Uint8Array,
        _consensusSize: number,
        _threshold: number
    ): TpkePublicKey {
        console.log('Aggregated commitment length:', commitment.length);

        // Try extracting as compressed G1 (48 bytes)
        if (commitment.length >= 48) {
            try {
                const g1Bytes = commitment.slice(0, 48);
                const hexString = bytesToHex(g1Bytes);
                const point = G1.fromHex(hexString);
                console.log('Created TPKE public key from first 48 bytes');
                return new TpkePublicKey(point);
            } catch (e) {
                console.log('Failed to parse first 48 bytes as G1, trying alternate format');
            }
        }

        // Alternative: Skip first 32 bytes (padding), take next 48
        if (commitment.length >= 96) {
            try {
                const g1Bytes = commitment.slice(32, 80);
                const hexString = bytesToHex(g1Bytes);
                const point = G1.fromHex(hexString);
                console.log('Created TPKE public key from bytes 32-80');
                return new TpkePublicKey(point);
            } catch (e) {
                console.log('Failed alternate G1 parsing');
            }
        }

        // If all else fails, try the full commitment
        const point = G1.fromHex(bytesToHex(commitment));
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
        const U = G1.BASE.multiply(r1);

        // Deriving the AES key from U
        const uBytes = U.toBytes();
        const aesKey = sha256(uBytes); // 32 bytes

        // 3. Compute encryptedKey components
        // C1 = U + PK * r2
        const pkTimesR2 = this.pg1.multiply(r2);
        const C1 = U.add(pkTimesR2);

        // C2 = G1 * r2
        const C2 = G1.BASE.multiply(r2);

        // C3 = - (G2 * r2)
        const g2R2 = G2.BASE.multiply(r2);
        const C3 = g2R2.negate();

        const cipherText = new Ciphertext(C1, C2, C3);
        const encryptedKey = cipherText.toBytes();

        // 4. AES-CBC Encrypt Message
        const iv = aesKey.slice(0, 16);

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
