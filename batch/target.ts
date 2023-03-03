import scanServers from 'utils/scan-servers.js';
import {computeBatchConfig} from 'utils/batch-config.js';

/** @param {NS} ns */
export async function main(ns) {
	const serverIgnore = ns.getPurchasedServers().join();
	const servers = scanServers(ns, ns.getHostname())
		.slice(1)
		.filter((server) => ns.hasRootAccess(server)
			&& ns.getServerMoneyAvailable(server)
			&& !serverIgnore.includes(server)
		);

	ns.tprint(servers);
	const configs = [...servers, 'max-hardware'].map((server) => ({server, ...computeBatchConfig(ns, server, 0.99)}));

	ns.tprint(JSON.stringify(configs, null, '\t'));
}
