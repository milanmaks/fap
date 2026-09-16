import fs from "fs/promises";
import path from "path";
import { StorageAdapter } from "./storage-adapter";

export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(
      process.cwd(),
      baseDir || process.env.UPLOAD_STORAGE_LOCAL_DIR || ".data/uploads"
    );
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch {
      // already exists
    }
  }

  private resolveKey(key: string): string {
    const safeKey = key.replace(/^[/\\]+/, "").replace(/[/\\]+/g, path.sep);
    const fullPath = path.resolve(this.baseDir, safeKey);
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error("Pokušaj pristupa fajlu van storage direktorijuma.");
    }
    return fullPath;
  }

  async saveFile(key: string, buffer: Buffer): Promise<string> {
    await this.ensureDir();
    const filePath = this.resolveKey(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return key;
  }

  async readFile(key: string): Promise<Buffer> {
    const filePath = this.resolveKey(key);
    return await fs.readFile(filePath);
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = this.resolveKey(key);
      await fs.unlink(filePath);
    } catch {
      // ignore if already deleted
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveKey(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const defaultStorageAdapter = new LocalStorageAdapter();
