export interface LogMeta {
  traceId?: string;
  actorId?: string;
  path?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  [key: string]: unknown;
}

export const logger = {
  info(message: string, meta?: LogMeta): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      ...meta,
    };
    console.log(JSON.stringify(entry));
  },

  warn(message: string, meta?: LogMeta): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      ...meta,
    };
    console.warn(JSON.stringify(entry));
  },

  error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    let errName: string | undefined;
    let errMsg: string | undefined;

    if (error instanceof Error) {
      errName = error.name;
      errMsg = error.message;
    } else if (typeof error === 'string') {
      errMsg = error;
    } else if (typeof error === 'object' && error !== null) {
      errMsg = (error as any).message || (error as any).sanitizedMessage || JSON.stringify(error);
    } else if (error !== undefined) {
      errMsg = String(error);
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      errorName: errName,
      errorMessage: errMsg,
      ...meta,
    };
    console.error(JSON.stringify(entry));
  },

  debug(message: string, meta?: LogMeta): void {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message,
        ...meta,
      };
      console.debug(JSON.stringify(entry));
    }
  },
};
