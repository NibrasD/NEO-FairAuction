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
        public cMsg: any, // G1 ProjectivePoint
        public bigR: any, // G1 ProjectivePoint
        public commitment: any // G2 ProjectivePoint
    ) { }

    toBytes(): Uint8Array {
        // Standard compressed serialization for BLS12-381
        // G1 compressed = 48 bytes
        // G2 compressed = 96 bytes
        // Total should be 192 bytes
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
    private pg1: any; // G1 ProjectivePoint

    constructor(pg1: any) {
        this.pg1 = pg1;
    }

    static fromBytes(bytes: Uint8Array): TpkePublicKey {
        // noble-curves handles hex string or Uint8Array
        const hexString = bytesToHex(bytes);
        const points = bls12_381.G1.Point.fromHex(hexString);
        return new TpkePublicKey(points);
    }

    encrypt(msg: Uint8Array): { encryptedKey: Uint8Array, encryptedMsg: Uint8Array } {
        // 1. Generate random scalars r1, r2
        // noble-curves utility gives valid random private keys (scalars)
        const r1Bytes = bls12_381.utils.randomSecretKey();
        const r1 = bytesToBigInt(r1Bytes);

        const r2Bytes = bls12_381.utils.randomSecretKey();
        const r2 = bytesToBigInt(r2Bytes);

        // 2. Compute ephemeral points
        // U = G1 * r1
        const U = bls12_381.G1.Point.BASE.multiply(r1);

        // Deriving the AES key from U
        // The reference implementation uses uncompressed bytes of U to hash
        const uBytes = U.toBytes(false); // false = uncompressed
        const aesKey = sha256(uBytes); // 32 bytes

        // 3. Compute encryptedKey components (The TPKE Ciphertext "Header")
        // C1 = U + PK * r2 (Blinded Ephemeral Key)
        const pkTimesR2 = this.pg1.multiply(r2);
        const C1 = U.add(pkTimesR2);

        // C2 = G1 * r2
        const C2 = bls12_381.G1.Point.BASE.multiply(r2);

        // C3 = - (G2 * r2) 
        // Note: G2 * r2 is computed then negated
        const g2R2 = bls12_381.G2.Point.BASE.multiply(r2);
        const C3 = g2R2.negate();

        const cipherText = new Ciphertext(C1, C2, C3);
        const encryptedKey = cipherText.toBytes();

        // 4. AES-CBC Encrypt Message
        const iv = aesKey.slice(0, 16); // Use first 16 bytes of hash as IV

        // aes-js requires input to be multiple of 16 bytes for CBC, so we must pad
        const paddedMsg = aesjs.padding.pkcs7.pad(msg);
        const aesCbc = new aesjs.ModeOfOperation.cbc(aesKey, iv);
        const encryptedMsg = aesCbc.encrypt(paddedMsg);

        return {
            encryptedKey,
            encryptedMsg
        };
    }
}
