import { AsyncLocalStorage } from 'node:async_hooks';

export interface UserContext {
  userId: string;
}

export const userContextStorage = new AsyncLocalStorage<UserContext>();

export function getCurrentUserId(): string | undefined {
  return userContextStorage.getStore()?.userId;
}
