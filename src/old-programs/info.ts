export {};
// import { NS } from '@ns';
// import { AutocompleteData, Command, Parameter, ParameterType, ParameterValue, Program } from '../lib/program';
// import { dfsServers, bfsServers } from '../lib/scan-servers';
// import { ServerInfo } from '../lib/server-info';

// export async function main(ns: NS) {
//   await new InfoProgram(ns).execute(ns, ns.args);
// }

// export function autocomplete(data: AutocompleteData, args: string[]) {
//   const program = new InfoProgram();
//   return program.autocomplete(data, args);
// }

// export class InfoProgram extends Program {
//   constructor(ns?: NS) {
//     super();

//     // Setup commands
//     this.addCommand(
//       new Command(
//         'get',
//         this.get,
//         [new Parameter('0', ParameterType.string, true)],
//         'get <server>',
//         'Shows info on a server.',
//       ),
//     );

//     this.addCommand(
//       new Command(
//         'top',
//         this.top,
//         [new Parameter('server', ParameterType.string, false, ns?.getHostname())],
//         'get <server>',
//         'Shows running scripts info.',
//       ),
//     );

//     this.addCommand(
//       new Command(
//         'scan',
//         this.scan,
//         [
//           new Parameter('bfs', ParameterType.boolean, false, false),
//           new Parameter('root-only', ParameterType.boolean, false, false),
//         ],
//         'scan [--bfs] [--root-only]',
//         'Scan the network and shows info on the servers.',
//       ),
//     );

//     this.addCommand(
//       new Command(
//         'path',
//         this.path,
//         [
//           new Parameter('0', ParameterType.string, true),
//           new Parameter('server', ParameterType.string, false, ns?.getHostname()),
//         ],
//         'path [--server] <target>',
//         'Compute the path towards the target.',
//       ),
//     );

//     this.addCommand(
//       new Command('find-contracts', this.contracts, [], 'find-contracts', 'Find contracts in the network.'),
//     );
//   }

//   async contracts() {
//     bfsServers(this.ns, this.ns.getHostname(), (server) => {
//       const codingContracts = this.ns.ls(server, '.cct');
//       if (codingContracts.length > 0) {
//         this.print(`Found coding contracts on ${server} (${codingContracts.join(', ')}).`);
//       }
//     });
//   }

//   async get(parameters: Map<string, ParameterValue>) {
//     const target = parameters.get('0') as string;
//     this.print(new ServerInfo(this.ns, target).toString());
//   }

//   async top(parameters: Map<string, ParameterValue>) {
//     const server = new ServerInfo(this.ns, parameters.get('server') as string);
//     const runners = this.ns.ps(server.hostname).filter(({ filename }) => filename === 'runner.js');
//     const ramUsage = [
//       this.ns.getScriptRam('runner.js', server.hostname) * runners.length,
//       ...runners.flatMap(({ args }) =>
//         args.flatMap((arg) => (typeof arg === 'string' && arg.startsWith('--ram=') ? Number(arg.slice(6)) : [])),
//       ),
//     ].reduce((a, b) => a + b);

//     const displayInfo = [`${server.hostname}:`];

//     displayInfo.push(...runners.map(({ filename, args }) => `${filename} ${args[0]}\t\t${args.slice(1)}`));

//     displayInfo.push(
//       `Total ram usage: ${this.ns.formatRam(ramUsage)} (free: ${this.ns.formatRam(
//         server.ram - ramUsage,
//       )}, max: ${this.ns.formatRam(server.ram)})`,
//     );

//     this.print(displayInfo.join('\n\t'));
//   }

//   async scan(parameters: Map<string, ParameterValue>) {
//     const useBfs = parameters.get('bfs') as boolean;
//     const showRootOnly = parameters.get('root-only') as boolean;

//     const servers: { info: ServerInfo; distance: number }[] = [];
//     if (useBfs) {
//       bfsServers(this.ns, 'home', (server, distance: number) =>
//         servers.push({ info: new ServerInfo(this.ns, server), distance }),
//       );
//     } else {
//       dfsServers(this.ns, 'home', (server, distance: number) =>
//         servers.push({ info: new ServerInfo(this.ns, server), distance }),
//       );
//     }

//     for (const server of servers) {
//       if (!showRootOnly || server.info.hasRootAccess) {
//         this.print(`${server.distance} ${server.info.toString()}`);
//       }
//     }
//   }

//   async path(parameters: Map<string, ParameterValue>) {
//     const targetHostname = parameters.get('0') as string;
//     const serverHostname = parameters.get('server') as string;

//     if (!this.ns.serverExists(targetHostname)) {
//       throw `Unknown target: ${targetHostname}`;
//       return;
//     }
//     if (!this.ns.serverExists(serverHostname)) {
//       throw `Unknown server: ${serverHostname}`;
//       return;
//     }

//     const servers: { info: ServerInfo; distance: number }[] = [];
//     dfsServers(this.ns, serverHostname, (server, distance: number) =>
//       servers.push({ info: new ServerInfo(this.ns, server), distance }),
//     );

//     const path: string[] = [];
//     let index = 0;
//     let distance = 0;

//     for (; index < servers.length; index += 1) {
//       if (servers[index].info.hostname === targetHostname) {
//         path.push(servers[index].info.hostname);
//         distance = servers[index].distance;
//         break;
//       }
//     }

//     for (; index > 0; index -= 1) {
//       if (servers[index].distance < distance) {
//         distance = servers[index].distance;
//         path.push(servers[index].info.hostname);
//         if (servers[index].info.server.backdoorInstalled) break;
//       }
//     }

//     this.print(`[home, ${path.reverse().join(', ')}]`);
//   }
// }
