import { NS } from '@ns';

export function dfsServers(ns: NS, hostname: string, fn: (server: string, height: number) => void) {
  const visitedServers: Map<string, boolean> = new Map();
  let serverStack: string[] = [hostname];
  let server!: string;
  let height = 0;

  while (serverStack.length > 0) {
    [server, ...serverStack] = serverStack;

    if (server === '+') {
      height += 1;
      continue;
    } else if (server === '-') {
      height -= 1;
      continue;
    } else if (visitedServers.has(server)) {
      continue;
    }

    visitedServers.set(server, true);
    fn(server, height);

    serverStack = ['-', ...serverStack];

    const neighboors = ns.scan(server);
    for (const neighboor of neighboors.reverse()) {
      serverStack = [neighboor, ...serverStack];
    }

    serverStack = ['+', ...serverStack];
  }
}

export function bfsServers(ns: NS, hostname: string, fn: (server: string, height: number) => void) {
  const visitedServers: Map<string, boolean> = new Map();
  let serverQueue: string[] = [hostname, '+'];
  let server!: string;
  let height = 0;

  while (serverQueue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    [server, ...serverQueue] = serverQueue;

    if (server === '+') {
      height += 1;
      if (serverQueue.length > 0) {
        serverQueue.push('+');
      }
      continue;
    } else if (visitedServers.has(server)) {
      continue;
    }

    visitedServers.set(server, true);
    fn(server, height);

    serverQueue.push(...ns.scan(server));
  }
}
