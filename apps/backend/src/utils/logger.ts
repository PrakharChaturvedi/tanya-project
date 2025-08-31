export const logger = {
  debug: (...args: unknown[]) => console.debug(new Date().toISOString(), "[DEBUG]", ...args),
  info:  (...args: unknown[]) => console.info(new Date().toISOString(), "[INFO]",  ...args),
  warn:  (...args: unknown[]) => console.warn(new Date().toISOString(), "[WARN]",  ...args),
  error: (...args: unknown[]) => console.error(new Date().toISOString(), "[ERROR]", ...args),
};
