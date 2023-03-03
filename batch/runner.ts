import {parseArgs} from 'utils/args.js';

/** @param {NS} ns */
export async function main(ns) {
	const COMMANDS = {
		start: {
			types: {},
			/** @param {BatchManager} manager */
			async execute({server, target}) {
				const manager = new BatchManager(ns, server, target)
				await manager.hackTarget();
			},
		},
		config: {
			types: {'0': 'number'},
			async execute({server, target, ...args}) {
				const manager = new BatchManager(ns, server, target)
				ns.tprint(JSON.stringify(manager.computeBatchConfig(args[0]), null, '\t'));
			},
		},
	}

	executeCommand(ns, COMMANDS);
}

function executeCommand(ns, commands) {
	const [command] = ns.args;
	const {types, execute} = commands[command];
	const args = parseArgs(ns.args, types, {});

	try {
		await execute(manager, args);
	} catch (error) {
		ns.tprint(`Error: ${error}`);
	}
}

class BatchManager {
	/** @param {NS} ns @param {string} server @param {string} target */
	constructor(ns, server, target) {
		this.ns = ns;
		this.server = server || ns.getHostname();
		this.target = target || ns.getHostname().slice(6);

		this.disableUnwantedLogs();

		if (!ns.serverExists(server)) {
			throw `Unkown server ${server}`;
		}

		if (!ns.serverExists(target)) {
			throw `Unkown target ${target}`;
		}
	}

	disableUnwantedLogs() {
		this.ns.disableLog('ALL');
	}

	/** Weaken the target's security level until it reaches its minimum value. */
	async minimiseTargetSecurityLevel() {
		while (this.ns.getServerSecurityLevel(this.target) > this.ns.getServerMinSecurityLevel(this.target)) {
			this.printTargetState();

			const threads = Math.min(this.countWeakenThreads(this.target), this.getAvailableThreads(this.server));
			this.ns.exec('weaken.js', this.server, threads, this.target, 0);

			const batchTime = this.ns.getWeakenTime(this.target) + 1000;
			this.printBatchStart('Weakening', batchTime, threads)
			await this.ns.sleep(batchTime);
		}
	}

	/** Grows the target's money until it reaches its maximum amount. */
	async maximiseTargetMoney() {
		while (this.ns.getServerMoneyAvailable(this.target) < this.ns.getServerMaxMoney(this.target)) {
			this.printTargetState();

			const availableThreads = this.getAvailableThreads(this.server);
			const weakenThreads = Math.ceil(availableThreads / (WEAKEN_SECURITY / GROW_SECURTY));
			const growThreads = availableThreads - weakenThreads;

			const growTime = this.ns.getGrowTime(this.target);
			const weakenTime = this.ns.getWeakenTime(this.target);
			const batchTime = weakenTime + 1000;

			this.printBatchStart('Growing', batchTime, growThreads + weakenThreads);

			this.ns.exec('weaken.js', this.server, weakenThreads, this.target, 0);
			this.ns.exec('grow.js', this.server, growThreads, this.target, weakenTime - 1000 - growTime);
			await this.ns.sleep(batchTime);
		}
	}

	/** Continously hacks the target */
	async hackTarget() {
		const HACK_SECURTY = 0.002;
		const GROW_SECURTY = 0.004;
		const WEAKEN_SECURITY = 0.05;

		await this.minimiseTargetSecurityLevel();

		await this.maximiseTargetMoney();

		// Find HWGW batch config;
		let config = {moneyToHack: 0, hackThreads: 0, weakenThreadsForHack: 0, growThreads: 0, weakenThreadsForGrow: 0};
		let moneyToHackRatioHalfRange = 0.99 / 2;
		let moneyToHackRatio = moneyToHackRatioHalfRange;
		while (true) {
			const maxMoney = this.ns.getServerMaxMoney(this.target);
			const moneyToHack = maxMoney * moneyToHackRatio;
			const hackThreads = Math.floor(this.ns.hackAnalyzeThreads(this.target, moneyToHack));

			const growthAmount = maxMoney / (maxMoney - moneyToHack);
			const growThreads = Math.ceil(this.ns.growthAnalyze(this.target, growthAmount));

			const hackSecurityTotal = hackThreads * HACK_SECURTY;
			const weakenThreadsForHack = Math.ceil(hackSecurityTotal / WEAKEN_SECURITY);

			const growSecurityTotal = growThreads * GROW_SECURTY;
			const weakenThreadsForGrow = Math.ceil(growSecurityTotal / WEAKEN_SECURITY);

			const totalSecurityIncrease =  hackSecurityTotal + growSecurityTotal;
			const totalSecurityDecrease = (weakenThreadsForHack + weakenThreadsForGrow) * WEAKEN_SECURITY;

			const ramUsage = (hackThreads + weakenThreadsForHack + growThreads + weakenThreadsForGrow) * 1.75;

			const hasEnoughRam = ramUsage <= (this.ns.getServerMaxRam(this.server) - this.ns.getServerUsedRam(this.server));
			const isSecurityDescresSufficient = totalSecurityDecrease >= totalSecurityIncrease;

			// this.ns.tprint(JSON.stringify({
			// 	moneyToHackRatioHalfRange, moneyToHackRatio,
			// 	maxMoney, moneyToHack, growthAmount,
			// 	hackThreads, weakenThreadsForHack, growThreads, weakenThreadsForGrow,
			// 	hackSecurityTotal, growSecurityTotal, totalSecurityIncrease, totalSecurityDecrease,
			// 	isSecurityDescresSufficient, ramUsage, hasEnoughRam,
			// }, null, '\t'));

			moneyToHackRatioHalfRange /= 2;
			if (hasEnoughRam && isSecurityDescresSufficient) {
				if (moneyToHack > config.moneyToHack) {
					config = {moneyToHack, hackThreads, weakenThreadsForHack, growThreads, weakenThreadsForGrow};
				}

				moneyToHackRatio += moneyToHackRatioHalfRange;
			} else {
				moneyToHackRatio -= moneyToHackRatioHalfRange;
			}

			if (moneyToHackRatioHalfRange <= 0.01) break;
		}

		this.ns.printf('Hacking configuration: %s', JSON.stringify(config, null, '\t'));
		while (true) {
			const hackTime = this.ns.getHackTime(this.target);
			const growTime = this.ns.getGrowTime(this.target);
			const weakenTime = this.ns.getWeakenTime(this.target);
			const waitTime = 1000;
			const batchTime = weakenTime + waitTime * 3;
			const totalThreads = config.hackThreads + config.weakenThreadsForHack + config.growThreads + config.weakenThreadsForGrow;

			// Run batch
			this.printBatchStart('Hacking', batchTime, totalThreads);
			this.ns.exec('hack.js', this.server, config.hackThreads, this.target, weakenTime - waitTime - hackTime);
			this.ns.exec('weaken.js', this.server, config.weakenThreadsForHack, this.target, 0);
			this.ns.exec('grow.js', this.server, config.growThreads, this.target, weakenTime + waitTime - growTime);
			this.ns.exec('weaken.js', this.server, config.weakenThreadsForGrow, this.target, waitTime * 2);
			await this.ns.sleep(batchTime);

			this.printStateAfterBatch();
		}
	}

	/** @param {string} target @returns {number} */
	countWeakenThreads(target) {
		const amountToDecrease = this.ns.getServerSecurityLevel(target) - this.ns.getServerMinSecurityLevel(target);
		return Math.ceil(amountToDecrease / 0.05);
	}

	/** @param {string} server @returns {number} */
	getAvailableThreads(server) {
		return Math.floor((this.ns.getServerMaxRam(server) - this.ns.getServerUsedRam(server)) / 1.75);
	}

	/** Compute batch configuration
	 * @param {NS} ns
	 * @param {string} target
	 * @param {number} moneyToHackRatio;
	 * @returns {{
	 *  money: number,
	 *  hackThreads: number,
	 *  weakenThreadsForHack: number
	 *  growThreads: number,
	 *  weakenThreadsForGrow: number,
	 *  ramUsage: number,
	 * 	isSecurityDecreaseSufficient: boolean
	 * }} The configuration result
	 **/
	computeBatchConfig(moneyToHackRatio) {
		const HACK_SECURITY = 0.002;
		const GROW_SECURITY = 0.004;
		const WEAKEN_SECURITY = 0.05;

		const maxMoney = this.ns.getServerMaxMoney(this.target);
		const moneyToHack = maxMoney * moneyToHackRatio;
		const hackThreads = Math.floor(this.ns.hackAnalyzeThreads(this.target, moneyToHack));

		const growthAmount = maxMoney / (maxMoney - moneyToHack);
		const growThreads = Math.ceil(this.ns.growthAnalyze(this.target, growthAmount));

		const hackSecurityTotal = hackThreads * HACK_SECURITY;
		const weakenThreadsForHack = Math.ceil(hackSecurityTotal / WEAKEN_SECURITY);

		const growSecurityTotal = growThreads * GROW_SECURITY;
		const weakenThreadsForGrow = Math.ceil(growSecurityTotal / WEAKEN_SECURITY);

		const totalSecurityIncrease = hackSecurityTotal + growSecurityTotal;
		const totalSecurityDecrease = (weakenThreadsForHack + weakenThreadsForGrow) * WEAKEN_SECURITY;

		const ramUsage = (hackThreads + weakenThreadsForHack + growThreads + weakenThreadsForGrow) * 1.75;

		return {
			money: moneyToHack,
			hackThreads,
			weakenThreadsForHack,
			growThreads,
			weakenThreadsForGrow,
			ramUsage,
			isSecurityDecreaseSufficient: totalSecurityIncrease <= totalSecurityDecrease,
		};
	}

	/* PRINT HELPERS */

	printBatchStart(name, duration, threads) {
		this.log('%s %s (duration: %s, threads: %s) ',
			name,
			this.target,
			this.ns.nFormat(duration / 1000, '00:00:00'),
			threads
		);
	}

	printStateAfterBatch() {
		this.ns.printf('State after batch: %s', JSON.stringify({
			securityLevel: this.ns.nFormat(this.ns.getServerSecurityLevel(this.target), '0.00'),
			minSecurityLevel: this.ns.nFormat(this.ns.getServerMinSecurityLevel(this.target), '0.00'),
			money: this.ns.nFormat(this.ns.getServerMoneyAvailable(this.target), '($ 0.00 a)'),
			maxMoney: this.ns.nFormat(this.ns.getServerMaxMoney(this.target), '($ 0.00 a)'),
		}, null, '\t'));
	}

	printTargetState() {
		this.ns.printf('Target State (%s): %s', this.target, JSON.stringify({
			securityLevel: this.ns.nFormat(this.ns.getServerSecurityLevel(this.target), '0.00'),
			minSecurityLevel: this.ns.nFormat(this.ns.getServerMinSecurityLevel(this.target), '0.00'),
			money: this.ns.nFormat(this.ns.getServerMoneyAvailable(this.target), '($ 0.00 a)'),
			maxMoney: this.ns.nFormat(this.ns.getServerMaxMoney(this.target), '($ 0.00 a)'),
		}, null, '\t'));
	}
}
