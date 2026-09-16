export interface StorageAdapter {
  saveFile(key: string, buffer: Buffer): Promise<string>;
  readFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
