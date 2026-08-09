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
 * Custom authentication adapter for @whiskeysockets/baileys storing and reading
 * session credentials directly to/from database via Prisma (BaileysAuth table).
 * Uses stringified JSON format for 100% compatibility with SQLite & PostgreSQL.
 */
export const usePrismaAuthState = async (
  prisma: PrismaClient
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
}> => {
  const readData = async (key: string) => {
    try {
      const record = await prisma.baileysAuth.findUnique({
        where: { key },
      });
      if (!record || !record.value) return null;
      return JSON.parse(record.value, BufferJSON.reviver);
    } catch (error) {
      console.error(`[BaileysAuth] Error reading key '${key}':`, error);
      return null;
    }
  };

  const writeData = async (key: string, data: any) => {
    try {
      if (data === null || data === undefined) {
        await prisma.baileysAuth.deleteMany({ where: { key } });
        return;
      }
      const jsonString = JSON.stringify(data, BufferJSON.replacer);
      await prisma.baileysAuth.upsert({
        where: { key },
        create: { key, value: jsonString },
        update: { value: jsonString },
      });
    } catch (error) {
      console.error(`[BaileysAuth] Error writing key '${key}':`, error);
    }
  };

  const removeData = async (key: string) => {
    try {
      await prisma.baileysAuth.deleteMany({ where: { key } });
    } catch (error) {
      console.error(`[BaileysAuth] Error deleting key '${key}':`, error);
    }
  };

  const creds: AuthenticationCreds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: any } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              if (value) {
                data[id] = value;
              }
            })
          );
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
      await prisma.baileysAuth.deleteMany({});
    },
  };
};
