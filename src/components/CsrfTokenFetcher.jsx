import React, { useState } from "react";
import apiClient from "../api/apiClient";
import { decryptAESKey, decryptAES } from "../crypto/crypto.helper";

export default function CsrfTokenFetcher() {
  const [token, setToken] = useState(null);

  const fetchCsrf = async () => {
    try {
      const res = await apiClient.get("/csrf/token");

      const { encryptedKey, iv, ciphertext } = res.data;

      const aesKey = decryptAESKey(encryptedKey);   // RSA decrypt
      const decrypted = decryptAES(ciphertext, aesKey, iv);

      setToken(decrypted.csrfToken);
      console.log("CSRF Token:", decrypted.csrfToken);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <button onClick={fetchCsrf}>Get CSRF Token</button>
      {token && <p>Token: {token}</p>}
    </div>
  );
}
