import { NS, Server } from '@ns';
import { Display } from '@/lib/display';
import { Service } from './service';

export class PodService extends Service {
  private POD_NAME = 'pod';
  private POD_PURCHASE_RAM = 2;

  constructor(ns: NS, display: Display) {
    super(ns, display);
  }

  public getPodCount() {
    return this.ns.getPurchasedServers().length;
  }

  public getPodCountLimit() {
    return this.ns.getPurchasedServerLimit();
  }

  public getPurchaseCost() {
    return this.ns.getPurchasedServerCost(this.POD_PURCHASE_RAM);
  }

  public getPod(hostname: string) {
    if (!this.ns.getPurchasedServers().includes(hostname)) return null;
    return this.ns.getServer(hostname);
  }

  public getPods(): Server[] {
    return this.ns.getPurchasedServers().map(this.ns.getServer);
  }

  private getNextPodPurchase() {
    return this.getPodCount() < this.getPodCountLimit()
      ? { cost: this.ns.getPurchasedServerCost(this.POD_PURCHASE_RAM) }
      : null;
  }

  public purchaseNextPod() {
    const podPurchase = this.getNextPodPurchase();
    if (podPurchase == null) return null;
    if (this.ns.getPlayer().money < this.getPurchaseCost()) return podPurchase;

    const effectiveHostname = this.ns.purchaseServer(this.POD_NAME, this.POD_PURCHASE_RAM);
    if (effectiveHostname === '') return podPurchase;

    this.display.printSuccess(`${effectiveHostname} purchased!`);
    return this.getNextPodPurchase();
  }

  private getNextPodUpgrade() {
    const pods = this.getPods();
    if (pods.length === 0) return null;

    const podToUpgrade = pods.reduce((podToUpgrade, pod) => (pod.maxRam < podToUpgrade.maxRam ? pod : podToUpgrade));
    if (podToUpgrade.maxRam >= this.ns.getPurchasedServerMaxRam()) return null;

    const ramUpgrade = podToUpgrade.maxRam * 2;
    return {
      hostname: podToUpgrade.hostname,
      ram: ramUpgrade,
      cost: this.ns.getPurchasedServerUpgradeCost(podToUpgrade.hostname, ramUpgrade),
    };
  }

  public upgradeNextPod() {
    const podUpgrade = this.getNextPodUpgrade();
    if (podUpgrade === null) return null;
    if (this.ns.getPlayer().money < podUpgrade.cost) return podUpgrade;

    if (!this.ns.upgradePurchasedServer(podUpgrade.hostname, podUpgrade.ram)) return podUpgrade;

    this.display.printSuccess(`${podUpgrade.hostname} upgraded: ${this.ns.formatRam(podUpgrade.ram)}!`);
    return this.getNextPodUpgrade();
  }

  // private podInfo(hostname: string) {
  //   const serverInfo = new ServerInfo(this.ns, hostname);

  //   const upgrades: string[] = [];
  //   const maxRam = this.ns.getPurchasedServerMaxRam();
  //   for (let i = serverInfo.ram * 2; i <= maxRam; i *= 2) {
  //     const ram = i;
  //     const price = this.ns.getPurchasedServerUpgradeCost(hostname, i);
  //     if (price < 0) break;

  //     upgrades.push(`${this.ns.formatRam(ram)}: $${this.ns.formatNumber(price)}`);
  //   }

  //   /* eslint-disable prettier/prettier */
  //   this.print(
  //     `${hostname}:\n\t${[
  //       `Max Ram: ${this.ns.formatRam(serverInfo.ram)}`,
  //       `Used Ram: ${this.ns.formatRam(serverInfo.usedRam)}`,
  //       `Free Ram: ${this.ns.formatRam(serverInfo.freeRam)}`,
  //       `Upgrade Costs: \n\t\t${upgrades.join('\n\t\t')}`,
  //     ].join('\n\t')}`,
  //   );
  //   /* eslint-enable prettier/prettier */
  // }

  // async upgrade(parameters: Map<string, ParameterValue>) {
  //   const hostname = parameters.get('0') as string;
  //   const ram = parameters.get('1') as number;

  //   if (!this.ns.getPurchasedServers().includes(hostname)) {
  //     this.logError(`Invalid pod: ${hostname}`);
  //     return;
  //   }

  //   if (this.ns.upgradePurchasedServer(hostname, ram)) {
  //     this.print(`Pod ${hostname} upgraded to ${this.ns.formatRam(ram)}.`);
  //   } else {
  //     this.print(`Failed to upgrade pod ${hostname} to ${this.ns.formatRam(ram)}.`);
  //   }
  // }

  // async rename(parameters: Map<string, ParameterValue>) {
  //   const hostname = parameters.get('0') as string;
  //   const newHostname = parameters.get('1') as string;

  //   if (!this.ns.getPurchasedServers().includes(hostname)) {
  //     this.logError(`Invalid pod: ${hostname}`);
  //     return;
  //   }

  //   if (this.ns.renamePurchasedServer(hostname, newHostname)) {
  //     this.print(`Pod ${hostname} renamed to ${newHostname}.`);
  //   } else {
  //     this.print(`Failed to rename pod ${hostname} to ${newHostname}.`);
  //   }
  // }

  // async delete(parameters: Map<string, ParameterValue>) {
  //   const hostname = parameters.get('0') as string;

  //   if (!this.ns.getPurchasedServers().includes(hostname)) {
  //     this.logError(`Invalid pod: ${hostname}`);
  //     return;
  //   }
  //   const confirmDeletion: boolean = (await this.ns.prompt(`Confirm deletion of ${hostname}: `, {
  //     type: 'boolean',
  //   })) as boolean;

  //   if (confirmDeletion && this.ns.deleteServer(hostname)) {
  //     this.print(`Pod ${hostname} deleted.`);
  //   } else {
  //     this.print`Failed to delete ${hostname}.`;
  //   }
  // }

  // async info(parameters: Map<string, ParameterValue>) {
  //   const target = parameters.get('0') as string | null;
  //   this.ns.tprint(target);
  //   if (target != null) {
  //     this.podInfo(target);
  //     return;
  //   }

  //   const prices: string[] = [];
  //   let bestAffordablePrice = 0;
  //   let bestAffordableRam = 0;

  //   const playerMoney = this.ns.getPlayer().money;
  //   const maxRam = this.ns.getPurchasedServerMaxRam();
  //   this.print(maxRam.toString());
  //   for (let i = 2; i <= maxRam; i *= 2) {
  //     const ram = i;
  //     const price = this.ns.getPurchasedServerCost(i);

  //     if (price < playerMoney) {
  //       bestAffordableRam = ram;
  //       bestAffordablePrice = price;
  //     }

  //     prices.push(`${this.ns.formatRam(ram)}: $${this.ns.formatNumber(price)}`);
  //   }

  //   /* eslint-disable prettier/prettier */
  //   this.print(
  //     '\n\t' +
  //       [
  //         `Quantity: ${this.ns.getPurchasedServers().length}/${this.ns.getPurchasedServerLimit()}`,
  //         `Best Affordable: ${this.ns.formatRam(bestAffordableRam, 0)} for $${this.ns.formatNumber(bestAffordablePrice)}`,
  //         `Prices: \n\t\t${prices.join('\n\t\t')}`,
  //       ].join('\n\t'),
  //   );
  //   /* eslint-enable prettier/prettier */
  // }
}
