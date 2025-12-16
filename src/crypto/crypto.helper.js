// src/crypto/crypto.helper.js
const sessionKeys = {
  privateKey: null,
  publicKey: null,
  aesKey: null,
};

// Generate RSA key pair
async function generateKeyPair() {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
    return keyPair;
  } catch (error) {
    console.error("Error generating RSA key pair:", error);
    throw error;
  }
}

// Export public key to PEM format
async function exportPublicKey(publicKey) {
  try {
    const exported = await window.crypto.subtle.exportKey("spki", publicKey);
    const exportedAsString = arrayBufferToBase64(exported);
    const pemExported = `-----BEGIN PUBLIC KEY-----\n${exportedAsString}\n-----END PUBLIC KEY-----`;
    return pemExported;
  } catch (error) {
    console.error("Error exporting public key:", error);
    throw error;
  }
}

// Import public key from PEM format
async function importPublicKey(pem) {
  try {
    const pemContents = pem
      .replace(/-----BEGIN PUBLIC KEY-----/g, "")
      .replace(/-----END PUBLIC KEY-----/g, "")
      .replace(/\s+/g, "");
    
    const binaryDer = base64ToArrayBuffer(pemContents);
    
    return await window.crypto.subtle.importKey(
      "spki",
      binaryDer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );
  } catch (error) {
    console.error("Error importing public key:", error);
    throw error;
  }
}

// Import private key from PEM format
async function importPrivateKey(pem) {
  try {
    const pemContents = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s+/g, "");
    
    const binaryDer = base64ToArrayBuffer(pemContents);
    
    return await window.crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["decrypt"]
    );
  } catch (error) {
    console.error("Error importing private key:", error);
    throw error;
  }
}

// Encrypt data with AES
async function encryptAES(data, aesKeyHex) {
  try {
    const textEncoder = new TextEncoder();
    const dataBytes = textEncoder.encode(JSON.stringify(data));
    
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      hexStringToUint8Array(aesKeyHex),
      { name: "AES-CBC", length: 256 },
      false,
      ["encrypt"]
    );
    
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      aesKey,
      dataBytes
    );
    
    return {
      ciphertext: uint8ArrayToBase64(new Uint8Array(encrypted)),
      iv: uint8ArrayToBase64(iv),
    };
  } catch (error) {
    console.error("Error encrypting with AES:", error);
    throw error;
  }
}

// Decrypt AES data
async function decryptAES(ciphertextBase64, aesKeyHex, ivBase64) {
  try {
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      hexStringToUint8Array(aesKeyHex),
      { name: "AES-CBC", length: 256 },
      false,
      ["decrypt"]
    );
    
    const ciphertext = base64ToUint8Array(ciphertextBase64);
    const iv = base64ToUint8Array(ivBase64);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-CBC", iv: iv },
      aesKey,
      ciphertext
    );
    
    const textDecoder = new TextDecoder();
    const decryptedText = textDecoder.decode(decrypted);
    
    try {
      return JSON.parse(decryptedText);
    } catch (parseError) {
      console.warn("Failed to parse decrypted data as JSON, returning as text:", parseError);
      return decryptedText;
    }
  } catch (error) {
    console.error("Error decrypting AES:", error);
    throw error;
  }
}

// Encrypt AES key with RSA (for sending to server)
async function encryptAESKey(aesKeyHex, publicKeyPem) {
  try {
    const publicKey = await importPublicKey(publicKeyPem);
    const aesKeyBytes = hexStringToUint8Array(aesKeyHex);
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      aesKeyBytes
    );
    
    return arrayBufferToBase64(encrypted);
  } catch (error) {
    console.error("Error encrypting AES key:", error);
    throw error;
  }
}

// Decrypt AES key with RSA (from server)
async function decryptAESKey(encryptedKeyBase64, privateKey) {
  try {
    const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedKey
    );
    
    return uint8ArrayToHex(new Uint8Array(decrypted));
  } catch (error) {
    console.error("Error decrypting AES key:", error);
    throw error;
  }
}

// Load RSA key pair from localStorage
async function loadKeyPair() {
  try {
    const privateKeyPem = localStorage.getItem("rsa_private_key");
    const publicKeyPem = localStorage.getItem("rsa_public_key");
    
    if (!privateKeyPem || !publicKeyPem) {
      return null;
    }
    
    const privateKey = await importPrivateKey(privateKeyPem);
    const publicKey = await importPublicKey(publicKeyPem);
    
    return { privateKey, publicKey };
  } catch (error) {
    console.error("Error loading key pair:", error);
    localStorage.removeItem("rsa_private_key");
    localStorage.removeItem("rsa_public_key");
    return null;
  }
}

// Save RSA key pair to localStorage
async function saveKeyPair(privateKey, publicKey) {
  try {
    const privateKeyPem = await exportPrivateKey(privateKey);
    const publicKeyPem = await exportPublicKey(publicKey);
    
    localStorage.setItem("rsa_private_key", privateKeyPem);
    localStorage.setItem("rsa_public_key", publicKeyPem);
    
    console.log("✅ RSA keys saved to localStorage");
  } catch (error) {
    console.error("Error saving key pair:", error);
  }
}

// Export private key to PEM format (for storage)
async function exportPrivateKey(privateKey) {
  try {
    const exported = await window.crypto.subtle.exportKey("pkcs8", privateKey);
    const exportedAsString = arrayBufferToBase64(exported);
    return `-----BEGIN PRIVATE KEY-----\n${exportedAsString}\n-----END PRIVATE KEY-----`;
  } catch (error) {
    console.error("Error exporting private key:", error);
    throw error;
  }
}

// Decrypt server response (handles both encrypted and plain responses)
async function decryptServerResponse(response, privateKey) {
  try {
    console.log("🔐 Decrypting server response:", {
      encrypted: !!(response.encryptedKey && response.ciphertext && response.iv),
      encryptedKey: !!response.encryptedKey,
      ciphertext: !!response.ciphertext,
      iv: !!response.iv
    });

    // If response is not encrypted, return as-is
    if (!response.encryptedKey || !response.ciphertext || !response.iv) {
      console.log("📨 Response is not encrypted, returning as-is");
      return response;
    }

    // Decrypt AES key
    const aesKeyHex = await decryptAESKey(response.encryptedKey, privateKey);
    
    // Decrypt data
    const decryptedData = await decryptAES(
      response.ciphertext,
      aesKeyHex,
      response.iv
    );

    console.log("✅ Decryption successful, data type:", typeof decryptedData);
    
    return decryptedData;
  } catch (error) {
    console.error("❌ Error decrypting server response:", error);
    
    // Check if we have fallback plain data
    if (response.data) {
      console.log("🔄 Using fallback plain data from response.data");
      return response.data;
    }
    
    return response; // Return as-is if decryption fails
  }
}

// Initialize encryption for reseller authentication
async function initResellerEncryption() {
  try {
    console.log("🔄 Initializing reseller encryption...");
    
    // Try to load existing keys
    let keys = await loadKeyPair();
    
    if (!keys) {
      console.log("🔑 Generating new RSA key pair...");
      const keyPair = await generateKeyPair();
      
      // Save keys for future use
      await saveKeyPair(keyPair.privateKey, keyPair.publicKey);
      
      keys = {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey
      };
    }
    
    // Store in session
    sessionKeys.privateKey = keys.privateKey;
    sessionKeys.publicKey = keys.publicKey;
    
    console.log("✅ Reseller encryption initialized", {
      hasPrivateKey: !!sessionKeys.privateKey,
      hasPublicKey: !!sessionKeys.publicKey
    });
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize reseller encryption:", error);
    throw error;
  }
}

// Generate random AES key
function generateAESKey() {
  const randomBytes = window.crypto.getRandomValues(new Uint8Array(32));
  return uint8ArrayToHex(randomBytes);
}

// Helper functions
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function hexStringToUint8Array(hexString) {
  if (!hexString || hexString.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

function uint8ArrayToHex(uint8Array) {
  return Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

export {
  sessionKeys,
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  importPrivateKey,
  encryptAES,
  decryptAES,
  encryptAESKey,
  decryptAESKey,
  loadKeyPair,
  saveKeyPair,
  decryptServerResponse,
  initResellerEncryption,
  generateAESKey,
  base64ToUint8Array,
  uint8ArrayToBase64,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  hexStringToUint8Array,
  uint8ArrayToHex,
};