import { NS, Server } from '@ns';
import { Display } from '@/lib/display';
import { Service } from './service';

export class ServerService extends Service {
	constructor(ns: NS, display: Display) {
		super(ns, display);
	}

	public getServer(hostname: string) {
		if (!this.ns.serverExists(hostname)) return null;
		return this.ns.getServer(hostname);
	}

	public takeOverServer(server: Server) {
		if (this.ns.getPlayer().skills.hacking < server.requiredHackingSkill) return;

		const penetrationScripts = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];
		const penetrationFunctions = [
			this.ns.brutessh,
			this.ns.ftpcrack,
			this.ns.relaysmtp,
			this.ns.httpworm,
			this.ns.sqlinject,
		];

		// Open ports even if root access is already on
		let openPorts = 0;
		for (; openPorts < penetrationFunctions.length; openPorts += 1) {
			if (!this.ns.fileExists(penetrationScripts[openPorts])) break;
			penetrationFunctions[openPorts](server.hostname);
		}

		// Check if nuke is necessary/possible
		if (server.hasAdminRights) return;
		if (openPorts < server.numOpenPortsRequired) return;

		this.ns.nuke(server.hostname);
		this.display.printSuccess(`Server taken over: ${server.hostname}`);
	}

	public updateScripts(server: Server) {
		if (!server.hasAdminRights) return;

		this.ns.scp(['weaken.js', 'grow.js', 'hack.js'], server.hostname, 'home');
	}
}
