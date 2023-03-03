export {};
// import { NS } from '@ns';
// import { AutocompleteData, Command, Parameter, ParameterType, ParameterValue, Program } from './lib/program';
// import { ServerInfo } from './lib/server-info';

// export async function main(ns: NS) {
//   const program = new PodProgram();
//   await program.execute(ns, ns.args);
// }

// export function autocomplete(data: AutocompleteData, args: string[]) {
//   const program = new PodProgram();
//   return program.autocomplete(data, args);
// }

// class PodProgram extends Program {
//   constructor() {
//     super();

//     this.addCommand(new Command('ls', this.ls, [], 'ls', 'List avaiable pods.'));
//     this.addCommand(
//       new Command(
//         'purchase',
//         this.purchase,
//         [new Parameter('name', ParameterType.string, false, 'pod'), new Parameter('ram', ParameterType.number, false)],
//         'purchase',
//         'Purchases a new pod.',
//       ),
//     );
//     this.addCommand(
//       new Command(
//         'info',
//         this.info,
//         [new Parameter('0', ParameterType.string, false)],
//         'info [pod]',
//         'Shows info about every pods or a specified pod',
//       ),
//     );
//     this.addCommand(
//       new Command(
//         'upgrade',
//         this.upgrade,
//         [new Parameter('0', ParameterType.string, true), new Parameter('1', ParameterType.number, true)],
//         'upgrade <pod> <ram>',
//         'Upgrades the ram of specified pod to the specified ram.',
//       ),
//     );
//     this.addCommand(
//       new Command(
//         'rename',
//         this.rename,
//         [new Parameter('0', ParameterType.string, true), new Parameter('1', ParameterType.string, true)],
//         'rename <pod> <new hostname>',
//         'Renames the specified pod.',
//       ),
//     );
//     this.addCommand(
//       new Command(
//         'delete',
//         this.delete,
//         [new Parameter('0', ParameterType.string, true)],
//         'delete <pod>',
//         'Deletes a specified pod',
//       ),
//     );
//   }

//   async ls() {
//     this.print(`[${this.ns.getPurchasedServers().join(', ')}]`);
//   }

//   private podInfo(hostname: string) {
//     const serverInfo = new ServerInfo(this.ns, hostname);

//     const upgrades: string[] = [];
//     const maxRam = this.ns.getPurchasedServerMaxRam();
//     for (let i = serverInfo.ram * 2; i <= maxRam; i *= 2) {
//       const ram = i;
//       const price = this.ns.getPurchasedServerUpgradeCost(hostname, i);
//       if (price < 0) break;

//       upgrades.push(`${this.ns.formatRam(ram)}: $${this.ns.formatNumber(price)}`);
//     }

//     /* eslint-disable prettier/prettier */
//     this.print(
//       `${hostname}:\n\t${[
//         `Max Ram: ${this.ns.formatRam(serverInfo.ram)}`,
//         `Used Ram: ${this.ns.formatRam(serverInfo.usedRam)}`,
//         `Free Ram: ${this.ns.formatRam(serverInfo.freeRam)}`,
//         `Upgrade Costs: \n\t\t${upgrades.join('\n\t\t')}`,
//       ].join('\n\t')}`,
//     );
//     /* eslint-enable prettier/prettier */
//   }

//   async purchase(parameters: Map<string, ParameterValue>) {
//     const hostname = parameters.get('name') as string;
//     let ram = parameters.get('ram') as number | null;

//     if (ram === null) {
//       const playerMoney = this.ns.getPlayer().money;
//       ram = this.ns.getPurchasedServerMaxRam();
//       while (ram > 1 && this.ns.getPurchasedServerCost(ram) > playerMoney) ram /= 2;
//     }

//     const effectiveHostname = this.ns.purchaseServer(hostname, ram);
//     if (effectiveHostname !== '') {
//       this.print(`Successfuly purchased ${effectiveHostname} with ${this.ns.formatRam(ram)}`);
//     } else {
//       this.print('Purchase faied!');
//     }
//   }

//   async upgrade(parameters: Map<string, ParameterValue>) {
//     const hostname = parameters.get('0') as string;
//     const ram = parameters.get('1') as number;

//     if (!this.ns.getPurchasedServers().includes(hostname)) {
//       this.logError(`Invalid pod: ${hostname}`);
//       return;
//     }

//     if (this.ns.upgradePurchasedServer(hostname, ram)) {
//       this.print(`Pod ${hostname} upgraded to ${this.ns.formatRam(ram)}.`);
//     } else {
//       this.print(`Failed to upgrade pod ${hostname} to ${this.ns.formatRam(ram)}.`);
//     }
//   }

//   async rename(parameters: Map<string, ParameterValue>) {
//     const hostname = parameters.get('0') as string;
//     const newHostname = parameters.get('1') as string;

//     if (!this.ns.getPurchasedServers().includes(hostname)) {
//       this.logError(`Invalid pod: ${hostname}`);
//       return;
//     }

//     if (this.ns.renamePurchasedServer(hostname, newHostname)) {
//       this.print(`Pod ${hostname} renamed to ${newHostname}.`);
//     } else {
//       this.print(`Failed to rename pod ${hostname} to ${newHostname}.`);
//     }
//   }

//   async delete(parameters: Map<string, ParameterValue>) {
//     const hostname = parameters.get('0') as string;

//     if (!this.ns.getPurchasedServers().includes(hostname)) {
//       this.logError(`Invalid pod: ${hostname}`);
//       return;
//     }
//     const confirmDeletion: boolean = (await this.ns.prompt(`Confirm deletion of ${hostname}: `, {
//       type: 'boolean',
//     })) as boolean;

//     if (confirmDeletion && this.ns.deleteServer(hostname)) {
//       this.print(`Pod ${hostname} deleted.`);
//     } else {
//       this.print`Failed to delete ${hostname}.`;
//     }
//   }

//   async info(parameters: Map<string, ParameterValue>) {
//     const target = parameters.get('0') as string | null;
//     this.ns.tprint(target);
//     if (target != null) {
//       this.podInfo(target);
//       return;
//     }

//     const prices: string[] = [];
//     let bestAffordablePrice = 0;
//     let bestAffordableRam = 0;

//     const playerMoney = this.ns.getPlayer().money;
//     const maxRam = this.ns.getPurchasedServerMaxRam();
//     this.print(maxRam.toString());
//     for (let i = 2; i <= maxRam; i *= 2) {
//       const ram = i;
//       const price = this.ns.getPurchasedServerCost(i);

//       if (price < playerMoney) {
//         bestAffordableRam = ram;
//         bestAffordablePrice = price;
//       }

//       prices.push(`${this.ns.formatRam(ram)}: $${this.ns.formatNumber(price)}`);
//     }

//     /* eslint-disable prettier/prettier */
//     this.print(
//       '\n\t' +
//         [
//           `Quantity: ${this.ns.getPurchasedServers().length}/${this.ns.getPurchasedServerLimit()}`,
//           `Best Affordable: ${this.ns.formatRam(bestAffordableRam, 0)} for $${this.ns.formatNumber(bestAffordablePrice)}`,
//           `Prices: \n\t\t${prices.join('\n\t\t')}`,
//         ].join('\n\t'),
//     );
//     /* eslint-enable prettier/prettier */
//   }
// }
