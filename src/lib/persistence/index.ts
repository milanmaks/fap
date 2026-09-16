import { IRepository } from "./repository";
import { MemoryRepository } from "./memory-repository";
import { PrismaRepository } from "./prisma-repository";

const globalForRepo = global as unknown as { appRepository: IRepository };

function createRepository(): IRepository {
  // If DATABASE_URL is set and USE_PRISMA is explicitly enabled or present
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && process.env.USE_PRISMA === "true") {
    try {
      return new PrismaRepository();
    } catch (e) {
      console.warn("PrismaRepository failed to initialize, falling back to MemoryRepository:", e);
      return new MemoryRepository(true);
    }
  }

  // Default to MemoryRepository with pre-seeded demo data for instant zero-config experience
  return new MemoryRepository(true);
}

export const repository: IRepository = globalForRepo.appRepository || createRepository();
if (process.env.NODE_ENV !== "production") {
  globalForRepo.appRepository = repository;
}

export * from "./repository";
export * from "./memory-repository";
