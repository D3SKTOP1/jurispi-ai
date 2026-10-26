import crypto from "crypto";

/**
 * Cofre de credenciais e-INPI.
 *
 * A senha da conta e-INPI de terceiros (escritório) NUNCA é gravada em
 * claro. Cifra-se com AES-256-GCM; a chave de 32 bytes é derivada de um
 * segredo de ambiente (`INPI_CREDENTIAL_KEY`, ou `NEXTAUTH_SECRET` como
 * fallback) via scrypt. O texto cifrado guarda salt+iv+authTag+dados,
 * então a rotação do segredo só exige reencriptar (nada de IV fixo).
 *
 * Formato serializado (base64 por campo, separado por ":"):
 *   v1:<salt>:<iv>:<authTag>:<ciphertext>
 */

const VERSION = "v1";
const KEY_LEN = 32; // AES-256
const SALT_LEN = 16;
const IV_LEN = 12; // GCM recomenda 12 bytes

function secret(): string {
  const value = process.env.INPI_CREDENTIAL_KEY || process.env.NEXTAUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error(
      "INPI_CREDENTIAL_KEY (ou NEXTAUTH_SECRET) ausente/curto: defina um segredo forte para cifrar credenciais e-INPI."
    );
  }
  return value;
}

function deriveKey(salt: Buffer): Buffer {
  return crypto.scryptSync(secret(), salt, KEY_LEN);
}

/** Cifra um texto (senha ou login) e devolve a string serializada. */
export function encryptSecret(plain: string): string {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    salt.toString("base64"),
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Decifra uma string serializada por `encryptSecret`. */
export function decryptSecret(serialized: string): string {
  const parts = serialized.split(":");
  if (parts.length !== 5 || parts[0] !== VERSION) {
    throw new Error("Credencial e-INPI em formato inválido ou versão desconhecida.");
  }
  const [, saltB64, ivB64, tagB64, dataB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const key = deriveKey(salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Máscara para exibição/logs — nunca mostra a senha, só o login parcial. */
export function maskLogin(login: string): string {
  const trimmed = login.trim();
  if (trimmed.length <= 4) return "•".repeat(trimmed.length);
  return `${trimmed.slice(0, 2)}${"•".repeat(Math.max(trimmed.length - 4, 2))}${trimmed.slice(-2)}`;
}
