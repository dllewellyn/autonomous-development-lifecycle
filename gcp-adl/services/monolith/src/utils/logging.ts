/**
 * Structured logging utilities
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  metadata?: Record<string, any>;
}

export function log(
  level: LogLevel,
  service: string,
  message: string,
  metadata?: Record<string, any>
) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    metadata,
  };

  // In production, this would integrate with Cloud Logging
  // For now, we use structured console logging
  const logMessage = JSON.stringify(entry);

  switch (level) {
    case LogLevel.DEBUG:
      console.debug(logMessage);
      break;
    case LogLevel.INFO:
      console.info(logMessage);
      break;
    case LogLevel.WARN:
      console.warn(logMessage);
      break;
    case LogLevel.ERROR:
      console.error(logMessage);
      break;
  }
}

export const logger = {
  debug: (service: string, message: string, metadata?: Record<string, any>) =>
    log(LogLevel.DEBUG, service, message, metadata),
  info: (service: string, message: string, metadata?: Record<string, any>) =>
    log(LogLevel.INFO, service, message, metadata),
  warn: (service: string, message: string, metadata?: Record<string, any>) =>
    log(LogLevel.WARN, service, message, metadata),
  error: (service: string, message: string, metadata?: Record<string, any>) =>
    log(LogLevel.ERROR, service, message, metadata),
};
