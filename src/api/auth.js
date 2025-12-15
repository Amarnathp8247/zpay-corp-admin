import apiClient from "../api/apiClient";
import {
  sessionKeys,
  generateKeyPair,
  exportPublicKey,
  encryptAES,
  encryptAESKey,
  decryptAESKey,
  decryptAES,
  uint8ArrayToBase64,
  base64ToUint8Array
} from "../crypto/crypto.helper.js";

// Server public key
const SERVER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1LYRHL+5vRJk+Dz1AJyx
XVz2G0ya1XiWxoPLAo5mFwYMXXsiW4Ne5hKwy6UVnBw6jbUy4XvFYdypn/cSHcOy
wpSldDqKTstekphUyAALYgecuwURHqpY0slxEcYVNS2t8rsFH+E0wf4obyIKdhz6
65HRR45xRW+3ewt+GWURJDcnmli0O8KSWSDTNR8MHKywfxOVYMaG1h4Jy9pv6q7Z
lSYBDLvqh5PQkPs7nTCqs2uJD+N/kMfd5+AIJ85PhKiWeqp7YPLeLFhoZKAnVHHv
L+d9mLca248mvlpG4PHIRHb2LIDQbBG8mrT/uyGPQnsmYRMxHDanhJ2xwoK/mwhC
EwIDAQAB
-----END PUBLIC KEY-----`;

// --- Register User ---
export async function register(userData) {
  console.log("[Register] User data:", userData);

  try {
    const res = await apiClient.post("/auth/register", userData, { withCredentials: true });
    console.log("[Register] Response:", res.data);

    if (!res.data) throw new Error("Registration failed");
    return res.data;
  } catch (err) {
    console.error("[Register] Error:", err);
    throw err;
  }
}

// --- Login User ---
export async function login(userData) {
  console.log("[Login] User data:", userData);

  try {
    // 1️⃣ Ensure RSA keys exist
    if (!sessionKeys.privateKey || !sessionKeys.publicKey) {
      console.log("[Login] Generating new RSA key pair...");
      const keyPair = await generateKeyPair();
      sessionKeys.privateKey = keyPair.privateKey;
      sessionKeys.publicKey = keyPair.publicKey;
    } else {
      console.log("[Login] RSA keys already exist");
    }

    // 2️⃣ Export client public key
    const publicKeyPem = await exportPublicKey(sessionKeys.publicKey);
    console.log("[Login] Public key PEM:", publicKeyPem);

    // 3️⃣ Generate AES session key
    const aesKeyHex = Array.from(window.crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    sessionKeys.aesKey = aesKeyHex;
    console.log("[Login] AES session key:", aesKeyHex);

    // 4️⃣ Encrypt login payload
    const { ciphertext, iv } = await encryptAES(userData, aesKeyHex);
    const encryptedKey = await encryptAESKey(aesKeyHex, SERVER_PUBLIC_KEY);
    console.log("[Login] Encrypted AES key:", encryptedKey);
    console.log("[Login] Ciphertext (Base64):", uint8ArrayToBase64(ciphertext));
    console.log("[Login] IV (Base64):", uint8ArrayToBase64(iv));

    // 5️⃣ Send encrypted login request
    const res = await apiClient.post(
      "/auth/login",
      {
        encryptedKey,
        iv: uint8ArrayToBase64(iv),
        ciphertext: uint8ArrayToBase64(ciphertext),
        clientPublicKey: publicKeyPem
      },
      { withCredentials: true }
    );
    console.log("[Login] Server response:", res.data);

    const encrypted = res.data;
    if (!encrypted || !encrypted.encryptedKey || !encrypted.ciphertext || !encrypted.iv) {
      throw new Error("Invalid encrypted response from server");
    }

    // 6️⃣ Decrypt AES key and payload
    sessionKeys.aesKey = await decryptAESKey(encrypted.encryptedKey, sessionKeys.privateKey);
    console.log("[Login] Decrypted AES key:", sessionKeys.aesKey);

    const decryptedData = await decryptAES(
      base64ToUint8Array(encrypted.ciphertext),
      sessionKeys.aesKey,
      base64ToUint8Array(encrypted.iv)
    );

    console.log("[Login] Decrypted payload:", decryptedData);
    return decryptedData; // contains token, user info, etc.
  } catch (err) {
    console.error("[Login] Error:", err);
    throw err;
  }
}

// --- Get Session Keys ---
export function getSessionKeys() {
  console.log("[SessionKeys] Current session keys:", sessionKeys);
  return sessionKeys;
}
