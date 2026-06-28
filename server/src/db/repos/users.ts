/**
 * User repository — SQLite-backed CRUD for the users table.
 */

import { randomUUID } from "node:crypto";
import db from "../database.js";
import type { User } from "../../models/schemas.js";

// ─── Row → domain mapper ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUser(row: Record<string, any>): User {
  return {
    id: row["id"],
    fullName: row["full_name"],
    email: row["email"],
    phone: row["phone"],
    role: row["role"],
    status: row["status"],
    avatarUrl: row["avatar_url"] ?? null,
    documentNumber: row["document_number"] ?? null,
    rating: row["rating"] ?? null,
    totalRides: row["total_rides"],
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

// ─── Public API ───────────────────────────────────────────────────────────────

export function findUserById(id: string): User | undefined {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? toUser(row) : undefined;
}

export function findUserByPhone(phone: string): User | undefined {
  const row = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) as Record<string, unknown> | undefined;
  return row ? toUser(row) : undefined;
}

export function findUserByEmail(email: string): User | undefined {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as Record<string, unknown> | undefined;
  return row ? toUser(row) : undefined;
}

export function listAllUsers(): User[] {
  return (db.prepare("SELECT * FROM users ORDER BY created_at").all() as Record<string, unknown>[]).map(toUser);
}

export function listUsersByRole(role: string): User[] {
  const rows = db.prepare("SELECT * FROM users WHERE role = ?").all(role);
  return (rows as Record<string, unknown>[]).map(toUser);
}

export interface CreateUserInput {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status?: string;
  avatarUrl?: string | null;
  documentNumber?: string | null;
  rating?: number | null;
  totalRides?: number;
}

export function createUser(input: CreateUserInput): User {
  const now = new Date().toISOString();
  const id = input.id ?? randomUUID();
  db.prepare(`
    INSERT INTO users (id, full_name, email, phone, role, status,
                       avatar_url, document_number, rating, total_rides,
                       created_at, updated_at)
    VALUES (@id, @full_name, @email, @phone, @role, @status,
            @avatar_url, @document_number, @rating, @total_rides,
            @created_at, @updated_at)
  `).run({
    id,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    role: input.role,
    status: input.status ?? "active",
    avatar_url: input.avatarUrl ?? null,
    document_number: input.documentNumber ?? null,
    rating: input.rating ?? null,
    total_rides: input.totalRides ?? 0,
    created_at: now,
    updated_at: now,
  });
  return findUserById(id)!;
}

export function updateUser(
  id: string,
  updates: { fullName?: string; avatarUrl?: string | null },
): User | undefined {
  const existing = findUserById(id);
  if (!existing) return undefined;
  db.prepare(`
    UPDATE users
    SET full_name = @full_name,
        avatar_url = @avatar_url,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    full_name: updates.fullName ?? existing.fullName,
    avatar_url: updates.avatarUrl !== undefined ? updates.avatarUrl : existing.avatarUrl,
    updated_at: new Date().toISOString(),
  });
  return findUserById(id);
}

export function incrementTotalRides(userId: string): void {
  db.prepare(
    "UPDATE users SET total_rides = total_rides + 1, updated_at = @updated_at WHERE id = @id",
  ).run({ id: userId, updated_at: new Date().toISOString() });
}
