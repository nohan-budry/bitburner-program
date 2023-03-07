import { Service } from '@/services/service';
import { NS, Server } from '@ns';
import { bfsServers } from '@/lib/scan-servers';
import { Display } from '@/lib/display';
import { EventManager, HackEvent } from '@/lib/events';

enum TargetState {
	SIMPLE_HACK = 0,
	WAITING,
	PREPARING,
	BEST_BATCH,
	OPTIMAL_BATCH,
}

class TargetData {
	hostname: string;
	state: TargetState;
	position: number;
	servers: { hostname: string; threadCount: number }[] = [];

	constructor(hostname: string, state: TargetState, position: number) {
		this.hostname = hostname;
		this.state = state;
		this.position = position;
	}
}

class BatchAction {
	script: string;
	threadCount: number;
	waitDuration: number;

	constructor(script: string, threadCount: number, waitDuration: number) {
		this.script = script;
		this.threadCount = threadCount;
		this.waitDuration = waitDuration;
	}
}

export class HackService extends Service {
	public MAX_THREAD_COUNT_FOR_SIMPLE_BATCH = 100;
	public MIN_THREAD_COUNT_FOR_SIMPLE_BATCH = 20;
	public THREAD_RAM_USAGE = 1.75;
	public THRESHOLD_RAM_FOR_BATCH_MODE = 256;
	public HACK_SECURITY = 0.002;
	public GROW_SECURITY = 0.004;
	public WEAKEN_SECURITY = 0.05;
	public BEST_MONEY_TO_HACK_RATION = 0.9970488281;
	public WAIT_DURATION = 1000;

	private batchMode = false;
	private targetOrder: string[] = [];
	private targets: Map<string, TargetData> = new Map();

	constructor(ns: NS, display: Display) {
		super(ns, display);
	}

	public addEventsForMissingTargets(eventManager: EventManager) {
		const targetIgnore = ['home', ...this.ns.getPurchasedServers()];
		bfsServers(this.ns, 'home', (hostname) => {
			if (!this.targets.has(hostname) && this.ns.hasRootAccess(hostname) && !targetIgnore.includes(hostname)) {
				this.targets.set(
					hostname,
					new TargetData(
						hostname,
						this.batchMode ? TargetState.WAITING : TargetState.SIMPLE_HACK,
						this.targetOrder.length,
					),
				);
				this.targetOrder.push(hostname);
				eventManager.scheduleEvent(new HackEvent(hostname), 0);
			}
		});
	}

	public checkForSwitchToBatchMode() {
		if (this.batchMode) return;

		const totalPodRam = this.ns
			.getPurchasedServers()
			.map((hostname) => this.ns.getServerMaxRam(hostname))
			.reduce((a, b) => a + b, 0);
		if (totalPodRam >= this.THRESHOLD_RAM_FOR_BATCH_MODE) {
			this.batchMode = true;
		}
	}

	/**
	 * Starts a hack.
	 * @param target Target of the batch.
	 * @returns The time to wait until next hack.
	 */
	public runHackEvent(target: Server): number {
		const targetData = this.targets.get(target.hostname)!;
		targetData.servers = [];

		if (targetData.state === TargetState.SIMPLE_HACK) {
			if (!this.batchMode) {
				return this.startSimpleBatch(target);
			}

			// Switch to waiting state
			targetData.state = TargetState.WAITING;
			this.display.printInfo(`Waiting ${targetData.hostname} ...`);
		}

		const previousTargetData = this.getPreviousTargetData(targetData);
		if (targetData.state === TargetState.WAITING) {
			if (previousTargetData != null && previousTargetData.state < TargetState.OPTIMAL_BATCH) {
				return 60000;
			}

			// Switch to preparing state;
			targetData.state = TargetState.PREPARING;
			this.display.printInfo(`Preparing ${targetData.hostname} ...`);
		}

		const totalAvailableThreadCount = this.getTotalAvailableThreadCount();
		if (targetData.state === TargetState.PREPARING) {
			this.display.printInfo(
				`${target.hostname} { money: ${this.ns.formatNumber(target.moneyAvailable, 2)}/${this.ns.formatNumber(
					target.moneyMax,
					2,
				)}, security level: ${this.ns.formatNumber(target.hackDifficulty, 2)}/${this.ns.formatNumber(
					target.minDifficulty,
					2,
				)} }`,
			);

			if (target.hackDifficulty > target.minDifficulty) {
				// Weaken batch
				this.allocateSimpleBatch(targetData, totalAvailableThreadCount);
				return this.runWeakenBatch(targetData, totalAvailableThreadCount);
			} else if (target.moneyAvailable < target.moneyMax) {
				// Grow batch
				this.allocateSimpleBatch(targetData, totalAvailableThreadCount);
				return this.runGrowBatch(targetData, totalAvailableThreadCount);
			}

			// Switch to batch mode
			targetData.state = TargetState.BEST_BATCH;
			this.display.printInfo(`Running best batch ${targetData.hostname} ...`);
		}

		const optimalHackConfiguration = this.computeHackConfiguration(target, this.BEST_MONEY_TO_HACK_RATION);
		if (targetData.state === TargetState.BEST_BATCH) {
			// Best hack batch
			if (optimalHackConfiguration.totalThreadCount > totalAvailableThreadCount) {
				const bestHackConfiguration = this.findBestHackConfiguration(target, totalAvailableThreadCount);
				if (
					bestHackConfiguration === null ||
					bestHackConfiguration?.totalThreadCount < this.MIN_THREAD_COUNT_FOR_SIMPLE_BATCH
				) {
					return 60000;
				}

				this.allocateSimpleBatch(targetData, bestHackConfiguration.totalThreadCount);
				return this.runHackBatch(targetData, bestHackConfiguration);
			}

			// Switch to optimal batch state
			targetData.state = TargetState.OPTIMAL_BATCH;
			this.display.printInfo(`Running optimal batch ${targetData.hostname} ...`);
		}

		if (targetData.state === TargetState.OPTIMAL_BATCH) {
			// optimal hack batch
			this.allocateSimpleBatch(targetData, optimalHackConfiguration.totalThreadCount);
			return this.runHackBatch(targetData, optimalHackConfiguration);
		}

		throw `Unknown batch state for ${target.hostname}: ${targetData.state}`;
	}

	private getPreviousTargetData(targetData: TargetData) {
		if (targetData.position === 0) return null;
		return this.targets.get(this.targetOrder[targetData.position - 1])!;
	}

	private startSimpleBatch(target: Server): number {
		const threadCount = Math.min(
			Math.max(
				Math.min(this.MIN_THREAD_COUNT_FOR_SIMPLE_BATCH, this.getTotalAvailableThreadCount()),
				Math.floor(this.getTotalMaxThreadCount() / this.targets.size),
			),
			this.MAX_THREAD_COUNT_FOR_SIMPLE_BATCH,
		);
		if (threadCount > this.getTotalAvailableThreadCount()) {
			// Try again later
			this.display.debug(`Not enough threads for simple hack on ${target.hostname}`);
			return 60000;
		}

		this.allocateSimpleBatch(this.targets.get(target.hostname)!, threadCount);

		let actionDuration: number;
		let action: string;
		const shouldHack = this.getTotalMaxThreadCount() < this.MAX_THREAD_COUNT_FOR_SIMPLE_BATCH * 2;

		if (target.hackDifficulty < target.minDifficulty + 5 && !shouldHack) {
			// Weaken
			actionDuration = this.ns.getWeakenTime(target.hostname);
			action = 'weaken.js';
		} else if (target.moneyAvailable < 0.5 * target.moneyMax && !shouldHack) {
			// Grow
			actionDuration = this.ns.getGrowTime(target.hostname);
			action = 'grow.js';
		} else {
			// Hack
			actionDuration = this.ns.getHackTime(target.hostname);
			action = 'hack.js';
		}

		this.display.debug(`Running ${action} on ${target.hostname} with `, this.targets.get(target.hostname));
		for (const serverAllocation of this.targets.get(target.hostname)!.servers) {
			this.ns.exec(action, serverAllocation.hostname, serverAllocation.threadCount, target.hostname, 0);
		}

		return actionDuration;
	}

	private allocateSimpleBatch(targetData: TargetData, threadCount = 0) {
		if (threadCount <= 0) {
			targetData.servers = [];
			return;
		}

		for (const serverHostname of this.getServers()) {
			const serverAvailableThreadCount = this.getServerAvailableThreadCount(serverHostname);
			if (serverAvailableThreadCount > 0) {
				targetData.servers.push({
					hostname: serverHostname,
					threadCount: Math.min(serverAvailableThreadCount, threadCount),
				});
				threadCount -= serverAvailableThreadCount;
			}

			if (threadCount <= 0) break;
		}
	}

	/* HELPERS */

	private getServers() {
		if (this.batchMode) return this.ns.getPurchasedServers();

		const servers: string[] = [];
		bfsServers(this.ns, 'home', (hostname) => {
			if (hostname != 'home' && this.ns.hasRootAccess(hostname)) {
				servers.push(hostname);
			}
		});
		return servers;
	}

	private getServerMaxThreadCount(hostname: string): number {
		return Math.floor(this.ns.getServerMaxRam(hostname) / this.THREAD_RAM_USAGE);
	}

	private getServerUsedThreadCount(hostname: string): number {
		let threadCount = 0;
		for (const [, targetData] of this.targets) {
			for (const server of targetData.servers) {
				if (server.hostname === hostname) {
					threadCount += server.threadCount;
				}
			}
		}
		return threadCount;
	}

	private getServerAvailableThreadCount(hostname: string): number {
		return this.getServerMaxThreadCount(hostname) - this.getServerUsedThreadCount(hostname);
	}

	private getTotalMaxThreadCount(): number {
		return this.getServers()
			.map((hostname) => this.getServerMaxThreadCount(hostname))
			.reduce((result, value) => result + value);
	}

	private getTotalUsedThreadCount(): number {
		return this.getServers()
			.map((hostname) => this.getServerUsedThreadCount(hostname))
			.reduce((result, value) => result + value);
	}

	private getTotalAvailableThreadCount(): number {
		return this.getTotalMaxThreadCount() - this.getTotalUsedThreadCount();
	}

	private runActions(targetData: TargetData, actions: BatchAction[]) {
		for (const server of targetData.servers) {
			let serverThreadCount = server.threadCount;
			for (const action of actions) {
				if (serverThreadCount <= 0) break;
				if (action.threadCount <= 0) continue;

				const usedThreadCount = Math.min(serverThreadCount, action.threadCount);
				serverThreadCount -= usedThreadCount;
				action.threadCount -= usedThreadCount;
				this.ns.exec(action.script, server.hostname, usedThreadCount, targetData.hostname, action.waitDuration);
			}
		}
	}

	/** Weakens the server in order to minimise its security level. */
	private runWeakenBatch(targetData: TargetData, threadCount: number) {
		// Start weaken batch
		const batchDuration = this.ns.getWeakenTime(targetData.hostname) + this.WAIT_DURATION;
		this.display.debug(
			`Weakening ${targetData.hostname} { duration: ${this.ns.tFormat(batchDuration)}, threads: ${threadCount} }`,
		);

		this.runActions(targetData, [new BatchAction('weaken.js', threadCount, 0)]);
		return batchDuration;
	}

	/** Grows the server in order to maximise its money amount. */
	private runGrowBatch(targetData: TargetData, threadCount: number) {
		const weakenThreadCount = Math.ceil(threadCount / (this.WEAKEN_SECURITY / this.GROW_SECURITY));
		const growThreadCount = threadCount - weakenThreadCount;

		const weakenDuration = this.ns.getWeakenTime(targetData.hostname);
		const growDuration = this.ns.getGrowTime(targetData.hostname);
		const growWaitDuration = weakenDuration - this.WAIT_DURATION - growDuration;
		const batchDuration = weakenDuration + this.WAIT_DURATION;

		this.display.debug(
			`Growing ${targetData.hostname} { duration: ${this.ns.tFormat(batchDuration)}, threads: ${threadCount} }`,
		);

		this.runActions(targetData, [
			new BatchAction('weaken.js', weakenThreadCount, 0),
			new BatchAction('grow.js', growThreadCount, growWaitDuration),
		]);
		return batchDuration;
	}

	/** Hacks the server */
	private runHackBatch(targetData: TargetData, hackConfiguration: HackConfiguration) {
		const hackDuration = this.ns.getHackTime(targetData.hostname);
		const growDuration = this.ns.getGrowTime(targetData.hostname);
		const weakenDuration = this.ns.getWeakenTime(targetData.hostname);
		const batchDuration = weakenDuration + this.WAIT_DURATION * 3;

		const hackWaitDuration = weakenDuration - this.WAIT_DURATION - hackDuration;
		const weakenForHackWaitDuration = 0;
		const growWaitDuration = weakenDuration + this.WAIT_DURATION - growDuration;
		const weakenForGrowWaitDuration = this.WAIT_DURATION * 2;

		this.display.debug(
			`Hacking ${targetData.hostname} { ${[
				`reward: ${this.ns.formatNumber(hackConfiguration.moneyReward)}`,
				`duration: ${this.ns.tFormat(batchDuration)}`,
				`threads: ${hackConfiguration.totalThreadCount}`,
			].join(', ')} }`,
		);

		this.runActions(targetData, [
			new BatchAction('hack.js', hackConfiguration.hackThreadCount, hackWaitDuration),
			new BatchAction('weaken.js', hackConfiguration.weakenThreadCountForHack, weakenForHackWaitDuration),
			new BatchAction('grow.js', hackConfiguration.growThreadCount, growWaitDuration),
			new BatchAction('weaken.js', hackConfiguration.weakenThreadCountForGrow, weakenForGrowWaitDuration),
		]);
		return batchDuration;
	}

	private computeHackConfiguration(target: Server, moneyToHackRatio: number): HackConfiguration {
		const moneyToHack = target.moneyMax * moneyToHackRatio;
		const hackThreads = Math.floor(this.ns.hackAnalyzeThreads(target.hostname, moneyToHack));
		const hackSecurityIncrease = this.ns.hackAnalyzeSecurity(hackThreads, target.hostname);

		const growthAmount = target.moneyMax / (target.moneyMax - moneyToHack);
		const growThreads = Math.ceil(this.ns.growthAnalyze(target.hostname, growthAmount));
		const growSecurityIncrease = growThreads * this.GROW_SECURITY;

		const weakenThreadsForHack = Math.ceil(hackSecurityIncrease / this.WEAKEN_SECURITY);
		const weakenThreadsForGrow = Math.ceil(growSecurityIncrease / this.WEAKEN_SECURITY);

		const totalSecurityIncrease = hackSecurityIncrease + growSecurityIncrease;
		const totalSecurityDecrease = (weakenThreadsForHack + weakenThreadsForGrow) * this.WEAKEN_SECURITY;

		return new HackConfiguration(
			moneyToHack,
			hackThreads,
			weakenThreadsForHack,
			growThreads,
			weakenThreadsForGrow,
			totalSecurityIncrease <= totalSecurityDecrease,
		);
	}

	private findBestHackConfiguration(target: Server, maxThreadCount: number): HackConfiguration | null {
		let bestHackConfiguration: HackConfiguration | null = null;
		let moneyToHackRatioHalfRange = this.BEST_MONEY_TO_HACK_RATION / 2;
		let moneyToHackRatio = moneyToHackRatioHalfRange;
		while (true) {
			const hackConfiguration = this.computeHackConfiguration(target, moneyToHackRatio);

			moneyToHackRatioHalfRange /= 2;
			if (
				hackConfiguration.totalThreadCount <= maxThreadCount &&
				hackConfiguration.isSecurityDecreaseSufficient
			) {
				if (
					bestHackConfiguration == null ||
					hackConfiguration.moneyReward > bestHackConfiguration.moneyReward
				) {
					bestHackConfiguration = hackConfiguration;
				}

				moneyToHackRatio += moneyToHackRatioHalfRange;
			} else {
				moneyToHackRatio -= moneyToHackRatioHalfRange;
			}

			if (moneyToHackRatioHalfRange <= 0.001) break;
		}

		return bestHackConfiguration;
	}
}

class HackConfiguration {
	moneyReward: number;
	hackThreadCount: number;
	weakenThreadCountForHack: number;
	growThreadCount: number;
	weakenThreadCountForGrow: number;
	isSecurityDecreaseSufficient: boolean;

	constructor(
		moneyReward: number,
		hackThreadCount: number,
		weakenThreadCountForHack: number,
		growThreadCount: number,
		weakenThreadCountForGrow: number,
		isSecurityDecreaseSufficient: boolean,
	) {
		this.moneyReward = moneyReward;
		this.hackThreadCount = hackThreadCount;
		this.weakenThreadCountForHack = weakenThreadCountForHack;
		this.growThreadCount = growThreadCount;
		this.weakenThreadCountForGrow = weakenThreadCountForGrow;
		this.isSecurityDecreaseSufficient = isSecurityDecreaseSufficient;
	}

	public get totalThreadCount(): number {
		return (
			this.hackThreadCount + this.weakenThreadCountForHack + this.growThreadCount + this.weakenThreadCountForGrow
		);
	}
}
