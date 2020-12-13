
export class Logger {
  public static debug(source: string, message: string, DEBUG = true) {
    if (DEBUG) {
      console.log(`${source}:${message}`);
    }
  }

  public static log(source: string, message: string): void {
    console.log(`${source}: ${message}`);
  }

  public static warn(source: string, message: string): void {
    console.warn(`Warning: ${source} ${message}`);
  }

  public static error(source: string, message: string, e?: any) {
    console.error(`${source}:${message} `);
    if (e) {
      console.error(e);
    }
  }
}
