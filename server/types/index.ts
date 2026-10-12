export type Environment = 'development' | 'production' | 'test';

export interface AppConfig {
  env: Environment;
  port: number;
  host: string;
  databaseUrl: string;
  databaseType: 'sqlite' | 'mysql' | 'postgres';
  geminiModel: string;
  hasGeminiKey: boolean;
  corsOrigins: string[];
  jwtSecret: string;
  adminBootstrapEmail: string;
  adminBootstrapPassword: string;
  storageDir: string;
}

export type AccountStatus = 'ACTIVE' | 'PENDING' | 'DEACTIVATED';

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  role: 'APPLICANT' | 'RECRUITER' | 'INTERVIEWER' | 'HR_MANAGER' | 'ADMIN';
  accountStatus: AccountStatus;
  companyId: string | null;
  firstName: string;
  lastName: string;
  iat: number;
  exp: number;
}

export interface AuthSessionResponse {
  user: {
    id: string;
    email: string;
    role: string;
    accountStatus: AccountStatus;
    firstName: string;
    lastName: string;
    companyId: string | null;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface StandardErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  code?: string;
  message: string;
  path: string;
  traceId: string;
  details?: unknown;
}

export interface HealthResponse {
  status: 'UP' | 'DOWN';
  service: string;
  version: string;
  timestamp: string;
  database: 'UP' | 'DOWN';
  uptimeSeconds: number;
  checks: {
    database: {
      status: 'UP' | 'DOWN';
      latencyMs?: number;
      error?: string;
    };
  };
}

export interface DatabaseAdapter {
  query<T = unknown>(sql: string, params?: unknown[]): T[];
  queryOne<T = unknown>(sql: string, params?: unknown[]): T | null;
  execute(sql: string, params?: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  execScript(sql: string): void;
  ping(): Promise<{ ok: boolean; latencyMs: number }>;
  close(): void;
}
