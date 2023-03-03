import { NS, Server } from '@ns';

export class ServerInfo {
  private ns: NS;
  public server!: Server;
  public hostname: string;
  public hasRootAccess!: boolean;
  public numPortsRequired!: number;
  public requiredHackingLevel!: number;
  public securityLevel!: number;
  public minSecurityLevel!: number;
  public money!: number;
  public maxMoney!: number;
  public ram!: number;
  public usedRam!: number;

  public get cpuCore() {
    return this.server.cpuCores;
  }

  constructor(ns: NS, hostname: string) {
    this.ns = ns;
    this.hostname = hostname;
    this.update();
  }

  public update() {
    this.server = this.ns.getServer(this.hostname);
    this.hasRootAccess = this.ns.hasRootAccess(this.hostname);
    this.numPortsRequired = this.ns.getServerNumPortsRequired(this.hostname);
    this.requiredHackingLevel = this.ns.getServerRequiredHackingLevel(this.hostname);
    this.securityLevel = this.ns.getServerSecurityLevel(this.hostname);
    this.minSecurityLevel = this.ns.getServerMinSecurityLevel(this.hostname);
    this.money = this.ns.getServerMoneyAvailable(this.hostname);
    this.maxMoney = this.ns.getServerMaxMoney(this.hostname);
    this.ram = this.ns.getServerMaxRam(this.hostname);
    this.usedRam = this.ns.getServerUsedRam(this.hostname);
  }

  public get freeRam() {
    return this.ram - this.usedRam;
  }

  public canTakeOver(): boolean {
    if (this.requiredHackingLevel > this.ns.getPlayer().skills.hacking) return false;

    // Compute how many ports can be opened
    let openablePorts = 0;
    const scripts = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];
    while (openablePorts < scripts.length && this.ns.fileExists(scripts[openablePorts])) openablePorts += 1;

    return openablePorts >= this.numPortsRequired;
  }

  public toString() {
    /* eslint-disable prettier/prettier */
    return [
      `${this.hostname}:`,
      ...(this.hasRootAccess
        ? [`Has root access: ${this.hasRootAccess ? 'true' : false}`]
        : [
            `Required ports: ${this.numPortsRequired}`,
            `Required hacking level: ${this.requiredHackingLevel}`,
          ]),
      `Money: ${this.ns.formatNumber(this.money)} (max: ${this.ns.formatNumber(this.maxMoney)})`,
      `Security Level: ${this.ns.formatNumber(this.securityLevel)} (min: ${this.ns.formatNumber(this.minSecurityLevel)})`,
      `Ram: ${this.ns.formatRam(this.ram)} (used: ${this.ns.formatRam(this.usedRam)}, free: ${this.ns.formatRam(this.freeRam)})`,
    ].join('\n\t');
    /* eslint-enable prettier/prettier */
  }
}
