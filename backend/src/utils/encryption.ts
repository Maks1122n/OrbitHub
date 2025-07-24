import CryptoJS from 'crypto-js';
import { config } from '../config/env';

export class EncryptionUtil {
  private static key = config.encryptionKey;

  // Шифрование пароля
  static encrypt(password: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(password, this.key).toString();
      return encrypted;
    } catch (error) {
      throw new Error('Encryption failed');
    }
  }

  // Расшифровка пароля
  static decrypt(encryptedPassword: string): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedPassword, this.key);
      const password = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!password) {
        throw new Error('Invalid encrypted password');
      }
      
      return password;
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  // Генерация случайного ключа
  static generateKey(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString(CryptoJS.enc.Hex);
  }

  // Хеширование пароля для базы данных (одностороннее)
  static hash(password: string): string {
    return CryptoJS.SHA256(password + this.key).toString();
  }

  // Проверка хеша пароля
  static verifyHash(password: string, hash: string): boolean {
    return this.hash(password) === hash;
  }
} 