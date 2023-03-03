export {};
// import { NS } from '@ns';
// import { AutocompleteData, Command, Parameter, ParameterType, ParameterValue, Program } from './lib/program';
// import { bfsServers } from './lib/scan-servers';
// import { ServerInfo } from './lib/server-info';

// export async function main(ns: NS) {
//   await new ManagerProgram(ns).execute(ns, ns.args);
// }

// export function autocomplete(data: AutocompleteData, args: string[]) {
//   const program = new ManagerProgram();
//   return program.autocomplete(data, args);
// }

// export class ManagerProgram extends Program {
//   constructor(ns?: NS) {
//     super();
//     ns?.disableLog('ALL');

//     /* Setup Command */
//     this.addCommand(
//       new Command(
//         'take-over',
//         this.takeOver,
//         [
//           new Parameter('target', ParameterType.string, false, null),
//           new Parameter('server', ParameterType.string, false, ns?.getHostname()),
//         ],
//         'take-over [--target] [--server]',
//         'Take over every server or the specified target.',
//       ),
//     );

//     this.addCommand(
//       new Command(
//         'setup',
//         this.setup,
//         [
//           new Parameter('target', ParameterType.string, false, null),
//           new Parameter('server', ParameterType.string, false, ns?.getHostname()),
//           new Parameter('scripts', ParameterType.string, false, 'manager.js,runner.js,hack.js,grow.js,weaken.js'),
//         ],
//         'setup [--target] [--server] [--scripts]',
//         'Setup every server or the specified taget.',
//       ),
//     );
//   }

//   async takeOver(parameters: Map<string, ParameterValue>) {
//     const targetHostname = parameters.get('target') as string | null;

//     if (targetHostname != null) {
//       this.takeOverServer(new ServerInfo(this.ns, targetHostname));
//     } else {
//       const scanHostname = parameters.get('server') as string;

//       bfsServers(this.ns, scanHostname, (hostname) => {
//         const serverInfo = new ServerInfo(this.ns, hostname);
//         if (!serverInfo.hasRootAccess && serverInfo.canTakeOver()) {
//           this.takeOverServer(serverInfo);
//         }
//       });
//     }
//   }

//   public takeOverServer(serverInfo: ServerInfo) {
//     this.print(`Taking over ${serverInfo.hostname} ...`);

//     if (serverInfo.hasRootAccess) {
//       this.logError(`Root acces already available on ${serverInfo.hostname}`);
//       return;
//     }

//     const hackingLevel = this.ns.getPlayer().skills.hacking;
//     if (serverInfo.requiredHackingLevel > hackingLevel) {
//       this.logError(`Hacking level is too low (level: ${hackingLevel}, required: ${serverInfo.requiredHackingLevel})`);
//       return;
//     }

//     const scripts = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];
//     const hackFunctions = [this.ns.brutessh, this.ns.ftpcrack, this.ns.relaysmtp, this.ns.httpworm, this.ns.sqlinject];

//     let openPorts = 0;
//     for (; openPorts < hackFunctions.length; openPorts += 1) {
//       if (!this.ns.fileExists(scripts[openPorts])) break;
//       hackFunctions[openPorts](serverInfo.hostname);
//     }

//     if (openPorts >= serverInfo.numPortsRequired) {
//       this.ns.nuke(serverInfo.hostname);
//     } else {
//       this.logError(
//         `Not enough open ports on ${serverInfo.hostname}. Requires ${serverInfo.numPortsRequired} open ports!`,
//       );
//     }
//   }

//   async setup(parameters: Map<string, ParameterValue>) {
//     const targetHostname = parameters.get('target') as string | null;
//     const hostname = parameters.get('server') as string;
//     const scripts = (parameters.get('scripts') as string).split(',');

//     if (targetHostname != null) {
//       this.setupServer(scripts, hostname, targetHostname);
//     } else {
//       bfsServers(this.ns, hostname, (serverHostname) => {
//         const serverInfo = new ServerInfo(this.ns, serverHostname);
//         if (serverInfo.hasRootAccess) {
//           this.setupServer(scripts, hostname, serverHostname);
//         }
//       });
//     }
//   }

//   public setupServer(scripts: string[], hostname: string, target: string) {
//     this.print(`Setting up ${target} ...`);
//     this.ns.scp(scripts, target, hostname);
//   }
// }
