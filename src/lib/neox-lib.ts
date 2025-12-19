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
        console.log('--- fromAggregatedCommitment ---');
        console.log('Commitment length:', commitment.length);
        console.log('Commitment hex (start):', bytesToHex(commitment).slice(0, 64));

        // Format 1: 128 bytes (Two 64-byte words, each with 16-byte zero padding + 48-byte coordinate)
        // This is the uncompressed (X, Y) format often seen in Neo X EVM results
        if (commitment.length === 128) {
            try {
                console.log('Detected 128-byte format (likely uncompressed G1 with padding)');
                // Segment 1 (X): skip 16 bytes, take 48
                const x = commitment.slice(16, 64);
                // Segment 2 (Y): skip 16 bytes (at 64), take 48
                const y = commitment.slice(80, 128);

                // Concatenate into 96-byte uncompressed format
                const uncompressed = new Uint8Array(96);
                uncompressed.set(x, 0);
                uncompressed.set(y, 48);

                const hexString = bytesToHex(uncompressed);
                console.log('Attempting G1.fromHex with 96-byte uncompressed data...');
                const point = G1.fromHex(hexString);
                console.log('✓ Success: G1.fromHex (uncompressed)');
                return new TpkePublicKey(point);
            } catch (e: any) {
                console.log('Failed uncompressed G1 parsing:', e.message);
            }
        }

        // Format 2: 96 bytes (Uncompressed G1 point without extra padding)
        if (commitment.length === 96) {
            try {
                const hexString = bytesToHex(commitment);
                console.log('Attempting G1.fromHex with 96-byte data...');
                const point = G1.fromHex(hexString);
                console.log('✓ Success: G1.fromHex');
                return new TpkePublicKey(point);
            } catch (e: any) {
                console.log('Failed 96-byte G1 parsing:', e.message);
            }
        }

        // Format 3: 48 bytes (Compressed G1 point)
        if (commitment.length === 48) {
            try {
                const hexString = bytesToHex(commitment);
                console.log('Attempting G1.fromHex with 48-byte compressed data...');
                const point = G1.fromHex(hexString);
                console.log('✓ Success: G1.fromHex');
                return new TpkePublicKey(point);
            } catch (e: any) {
                console.log('Failed 48-byte G1 parsing:', e.message);
            }
        }

        // Alternative: Specific offset parsing if needed (legacy or specialized)
        if (commitment.length >= 80) {
            try {
                const g1Bytes = commitment.slice(32, 80);
                const hexString = bytesToHex(g1Bytes);
                console.log('Attempting alternate G1.fromHex (offset 32-80)...');
                const point = G1.fromHex(hexString);
                return new TpkePublicKey(point);
            } catch (e: any) {
                console.log('Failed alternate G1 parsing (32-80):', e.message);
            }
        }

        console.warn('Final fallback: trying full commitment parsing...');
        try {
            const point = G1.fromHex(bytesToHex(commitment));
            return new TpkePublicKey(point);
        } catch (e: any) {
            console.error('Final fallback failed:', e.message);
            throw new Error(`Invalid TPKE public key format. Got ${commitment.length} bytes. Check the console for more details.`);
        }
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
