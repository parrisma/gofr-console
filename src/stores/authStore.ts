// Authentication store for GOFR Console
// Backed by data/config/users.json (demo-only, replaced by Keycloak later)

import { tokenStore } from './tokenStore';
import type { JwtToken } from '../types/uiConfig';

export type UserType = 'Sales Trader' | 'Trader' | 'Analyst' | 'Logistics';

export interface AuthUser {
  username: string;
  displayName: string;
  userType: string;
  deskName: string;
  author: string;
  contactEmail: string;
  contactPhone: string;
  bloombergHandle: string;
}

interface UsersFileUser {
  username: string;
  displayName: string;
  userType: string;
  password: string;
  desk_name: string;
  author: string;
  contact_email: string;
  contact_phone: string;
  bloomberg_handle: string;
}

interface UsersFile {
  users: UsersFileUser[];
  tokens: JwtToken[];
}

class AuthStore {
  private _user: AuthUser | null = null;
  private _listeners: Set<() => void> = new Set();

  get authenticated(): boolean {
    return this._user !== null;
  }

  get user(): AuthUser | null {
    return this._user;
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) {
        return false;
      }
      const data: UsersFile = await response.json();
      const found = data.users.find(
        (u) => u.username === username && u.password === password
      );
      if (!found) {
        return false;
      }
      this._user = {
        username: found.username,
        displayName: found.displayName,
        userType: found.userType,
        deskName: found.desk_name ?? '',
        author: found.author ?? '',
        contactEmail: found.contact_email ?? '',
        contactPhone: found.contact_phone ?? '',
        bloombergHandle: found.bloomberg_handle ?? '',
      };
      // Load shared tokens into tokenStore
      tokenStore.setTokens(data.tokens ?? []);
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  logout(): void {
    this._user = null;
    tokenStore.setTokens([]);
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  getSnapshot(): AuthUser | null {
    return this._user;
  }

  private notify(): void {
    this._listeners.forEach((listener) => listener());
  }
}

// Singleton instance
export const authStore = new AuthStore();
