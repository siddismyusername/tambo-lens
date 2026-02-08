import { query, queryOne } from "../db";
import bcrypt from "bcryptjs";

// ──── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isDemo: boolean;
  createdAt: string;
}

export type UserSafe = Omit<User, "passwordHash">;

// ──── Column Alias Fragment ──────────────────────────────────────────────────

const USER_COLUMNS = `
  id,
  email,
  name,
  password_hash AS "passwordHash",
  is_demo       AS "isDemo",
  created_at    AS "createdAt"
`;

// ──── Auth Operations ────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  isDemo?: boolean;
}): Promise<UserSafe> {
  // Check if user already exists
  const existing = await getUserByEmail(input.email);
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const row = await queryOne<User>(
    `INSERT INTO users (email, password_hash, name, is_demo)
     VALUES ($1, $2, $3, $4)
     RETURNING ${USER_COLUMNS}`,
    [input.email, passwordHash, input.name, input.isDemo ?? false]
  );

  if (!row) throw new Error("Failed to create user");
  return toSafe(row);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>(
    `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
    [email]
  );
}

export async function getUserById(id: string): Promise<User | null> {
  return queryOne<User>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<UserSafe | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return toSafe(user);
}

// ──── Demo User Seeding ──────────────────────────────────────────────────────

export const DEMO_USER_EMAIL = "demo@tambolens.com";
export const DEMO_USER_PASSWORD = "demo1234";

export async function ensureDemoUser(): Promise<UserSafe> {
  const existing = await getUserByEmail(DEMO_USER_EMAIL);
  if (existing) return toSafe(existing);

  return createUser({
    email: DEMO_USER_EMAIL,
    password: DEMO_USER_PASSWORD,
    name: "Demo User",
    isDemo: true,
  });
}

/**
 * Associate any un-owned data sources with the demo user.
 * Called during seeding so the demo user has access to existing data.
 */
export async function associateOrphanedDataWithDemoUser(): Promise<void> {
  const demoUser = await getUserByEmail(DEMO_USER_EMAIL);
  if (!demoUser) return;

  // Assign any data sources with no user_id to the demo user
  await query(
    `UPDATE data_sources SET user_id = $1 WHERE user_id IS NULL`,
    [demoUser.id]
  );

  // Assign any dashboards with no user_id to the demo user
  await query(
    `UPDATE dashboards SET user_id = $1 WHERE user_id IS NULL`,
    [demoUser.id]
  );
}

// ──── Helpers ────────────────────────────────────────────────────────────────

function toSafe(user: User): UserSafe {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}
