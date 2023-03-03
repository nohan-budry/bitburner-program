import { NS } from '@ns';

export class Display {
  ns: NS;
  debugMode: boolean;

  constructor(ns: NS, debugMode: boolean) {
    this.ns = ns;
    this.debugMode = debugMode;

    this.debug('Debug Mode ON!');
  }

  public print(...args: unknown[]) {
    if (this.debugMode) {
      this.debug(...args);
      return;
    }

    this.ns.tprint(...args);
  }

  public log(...args: unknown[]) {
    if (this.debugMode) {
      this.debug(...args);
      return;
    }

    this.ns.print(...args);
  }

  public debug(...args: unknown[]) {
    if (this.debugMode) {
      this.ns.tprint('DEBUG ', ...args);
      this.ns.print('DEBUG ', ...args);
    }
  }

  /* HELPERS */
  public printInfo(...args: unknown[]) {
    this.print('INFO ', ...args);
  }

  public printWarn(...args: unknown[]) {
    this.print('WARN ', ...args);
  }

  public printError(...args: unknown[]) {
    this.print('ERROR ', ...args);
  }

  public printSuccess(...args: unknown[]) {
    this.print('SUCCESS ', ...args);
  }

  public logInfo(...args: unknown[]) {
    this.log('INFO ', ...args);
  }

  public logWarn(...args: unknown[]) {
    this.log('WARN ', ...args);
  }

  public logError(...args: unknown[]) {
    this.log('ERROR ', ...args);
  }

  public logSuccess(...args: unknown[]) {
    this.log('SUCCESS ', ...args);
  }
}
