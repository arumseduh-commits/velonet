import {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
  proto,
} from "@whiskeysockets/baileys";
import { PrismaClient } from "@prisma/client";

/**
 * Ultra-fast In-Memory Caching authentication adapter for @whiskeysockets/baileys.
 * Pre-loads auth keys into RAM to prevent SQLite database locking & crashes on Render free tier.
 */
export const usePrismaAuthState = async (
  prisma: PrismaClient
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
}> => {
  // In-memory cache map for 0ms RAM lookup
  const cache = new Map<string, any>();

  // Preload all auth keys into RAM on startup
  try {
    const allRecords = await prisma.baileysAuth.findMany();
    for (const rec of allRecords) {
      if (rec.value) {
        try {
          const parsed = JSON.parse(rec.value, BufferJSON.reviver);
          cache.set(rec.key, parsed);
        } catch (e) {
          // ignore parse error
        }
      }
    }
  } catch (err) {
    console.error("[BaileysAuth] Preload cache warning:", err);
  }

  const readData = (key: string) => {
    if (cache.has(key)) {
      return cache.get(key);
    }
    return null;
  };

  const writeData = async (key: string, data: any) => {
    try {
      if (data === null || data === undefined) {
        cache.delete(key);
        await prisma.baileysAuth.deleteMany({ where: { key } }).catch(() => {});
        return;
      }

      cache.set(key, data);
      const jsonString = JSON.stringify(data, BufferJSON.replacer);
      await prisma.baileysAuth.upsert({
        where: { key },
        create: { key, value: jsonString },
        update: { value: jsonString },
      }).catch((err) => {
        console.warn(`[BaileysAuth] Background write deferred for '${key}'`);
      });
    } catch (error) {
      console.error(`[BaileysAuth] Error writing key '${key}':`, error);
    }
  };

  const removeData = async (key: string) => {
    try {
      cache.delete(key);
      await prisma.baileysAuth.deleteMany({ where: { key } }).catch(() => {});
    } catch (error) {
      console.error(`[BaileysAuth] Error deleting key '${key}':`, error);
    }
  };

  const creds: AuthenticationCreds = readData("creds") || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: any } = {};
          for (const id of ids) {
            let value = readData(`${type}-${id}`);
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            if (value) {
              data[id] = value;
            }
          }
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category as keyof SignalDataTypeMap]) {
              const value = data[category as keyof SignalDataTypeMap]![id];
              const key = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(key, value));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData("creds", creds);
    },
    clearState: async () => {
      cache.clear();
      await prisma.baileysAuth.deleteMany({}).catch(() => {});
    },
  };
};
