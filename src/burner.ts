import { NS } from '@ns';
import { Display } from './lib/display';
import {
	EventManager,
	EventType,
	ManagePodsEvent,
	ExecuteControllerCommandsEvent,
	UpdateServersEvent,
	HackEvent,
} from './lib/events';
import { AutocompleteData, Command, ParameterValue, Program } from './lib/program';
import { bfsServers } from './lib/scan-servers';
import { PodService } from './services/pod.service';
import { ServerService } from './services/server.service';
import { BurnerControllerDelegate, BurnerControllerProgram } from '@/controller';
import { HackService } from '@/services/hack.service';

export async function main(ns: NS) {
	let debugMode = false;
	if (ns.args.length > 0 && ns.args[0] === '--debug') {
		ns.args.shift();
		debugMode = true;
	}
	const program = new BurnerProgram();
	program.initialise(ns, new Display(ns, debugMode));
	await program.execute(ns.args);
}

export function autocomplete(data: AutocompleteData, args: string[]) {
	if (args.length > 0 && args[0] === '--debug') {
		args.shift();
	}

	const program = new BurnerProgram();
	return program.autocomplete(data, args);
}

class BurnerProgram extends Program implements BurnerControllerDelegate {
	private controller: BurnerControllerProgram;
	private podService!: PodService;
	private serverService!: ServerService;
	private hackService!: HackService;
	private gatherMoney = false;
	private running = true;

	constructor() {
		super();

		this.controller = new BurnerControllerProgram(this);

		this.addCommand(new Command('start', this.start, [], 'start', 'Starts the burner main process.'));
	}

	protected get programName(): string {
		return 'Burner';
	}

	protected get programUsage(): string {
		return 'burner [--debug] <command> [..args]';
	}

	protected get programDescription(): string {
		return 'Main program automating the game.';
	}

	public override initialise(ns: NS, display: Display): void {
		super.initialise(ns, display);
		this.controller.initialise(ns, display);

		this.podService = new PodService(ns, display);
		this.serverService = new ServerService(ns, display);
		this.hackService = new HackService(ns, display);
	}

	async start() {
		const eventQueue = new EventManager(this.ns, this.display);

		// Add base events
		eventQueue.scheduleEvent(new ManagePodsEvent(), 0);
		eventQueue.scheduleEvent(new UpdateServersEvent(), 0);
		eventQueue.scheduleEvent(new ExecuteControllerCommandsEvent(), 0);
		this.hackService.checkForSwitchToBatchMode();
		this.hackService.addEventsForMissingTargets(eventQueue);

		// Execute events
		while (this.running) {
			const event = await eventQueue.waitForNextEvent();
			if (event == null) throw `No more event available!`;

			// Execute Event
			this.display.debug(`Executing event: `, event);
			switch (event.type) {
				case EventType.MANAGE_PODS:
					if (this.gatherMoney) {
						eventQueue.scheduleEvent(new ManagePodsEvent());
					} else {
						const waitDurationBeforeNextEvent = this.managePods();
						this.hackService.checkForSwitchToBatchMode();

						this.display.debug(`Waiting before next pod management event: ${waitDurationBeforeNextEvent}`);
						if (waitDurationBeforeNextEvent >= 0.0) {
							eventQueue.scheduleEvent(new ManagePodsEvent(), waitDurationBeforeNextEvent);
						}
					}
					break;
				case EventType.UPDATE_SERVERS:
					this.updateServers();
					this.hackService.addEventsForMissingTargets(eventQueue);
					eventQueue.scheduleEvent(new UpdateServersEvent());
					break;
				case EventType.EXECUTE_CONTROLLER_COMMANDS:
					await this.executeControllerCommands();
					eventQueue.scheduleEvent(new ExecuteControllerCommandsEvent());
					break;
				case EventType.HACK:
					{
						const hackEvent = event as HackEvent;
						const target = this.serverService.getServer(hackEvent.targetHostname)!;
						const waitDurationBeforeNextEvent = this.hackService.runHackEvent(target);
						this.display.debug(
							`Hack Event executed on ${target.hostname} (time until next: ${this.ns.tFormat(
								waitDurationBeforeNextEvent,
							)})`,
						);
						eventQueue.scheduleEvent(event, waitDurationBeforeNextEvent);
					}
					break;
			}
		}
	}

	private managePods(): number {
		// Purchase the next Pod
		const nextPodPurchase = this.podService.purchaseNextPod();
		this.display.debug('Next pod purchase: ', nextPodPurchase);
		if (nextPodPurchase != null) {
			return this.estimateTimeToOwnMoney(nextPodPurchase.cost);
		}

		// Upgrade the next pod
		const nextPodUpgrade = this.podService.upgradeNextPod();
		this.display.debug('Next pod upgrade: ', nextPodUpgrade);
		if (nextPodUpgrade != null) {
			return this.estimateTimeToOwnMoney(nextPodUpgrade.cost);
		}

		this.display.printInfo(`All pods have been fully upgraded!`);
		return -1;
	}

	private updateServers() {
		bfsServers(this.ns, this.ns.getHostname(), (hostname) => {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			let server = this.serverService.getServer(hostname)!;
			this.serverService.takeOverServer(server);

			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			server = this.serverService.getServer(hostname)!;
			this.serverService.updateScripts(server);
		});
	}

	private estimateTimeToOwnMoney(amount: number) {
		const missingMoney = amount - this.ns.getPlayer().money;
		if (missingMoney <= 0.0) return 0;

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const script = this.ns.getRunningScript()!;
		const scriptIncome = script.onlineMoneyMade / script.onlineRunningTime;

		if (scriptIncome <= 0.0) return 60000;
		return Math.min((missingMoney / scriptIncome) * 1000 + 1000, 60000);
	}

	/* Burner Controller Delegate */

	private async executeControllerCommands() {
		while (true) {
			const portData = this.ns.readPort(BurnerControllerProgram.MESSAGE_PORT) as string;
			if (portData === 'NULL PORT DATA') break;

			try {
				await this.controller.execute(portData.split(' '));
			} catch (error) {
				this.display.printError('Controller: ', error);
			}
		}
	}

	public async showNextPodOperation() {
		const nextPodPurchase = this.podService.getNextPodPurchase();
		if (nextPodPurchase != null) {
			this.display.printInfo('Next pod purchase: ', nextPodPurchase);
			return;
		}

		this.display.printInfo('Next pod upgrade: ', this.podService.getNextPodUpgrade());
	}

	public async killBurner(): Promise<void> {
		this.display.printWarn('Killing Burner ...');
		this.running = false;
		this.ns.kill(this.ns.getRunningScript()!.pid);
	}

	public async toggleDebugMode(parameters: Map<string, ParameterValue>): Promise<void> {
		this.display.debugMode = !(parameters.get('off') as boolean);
		this.display.printInfo(`Debug mode ${this.display.debugMode}`);
	}

	public async toggleGatherMoney(parameters: Map<string, ParameterValue>): Promise<void> {
		this.gatherMoney = !(parameters.get('off') as boolean);
		this.display.printInfo(`Gather money mode ${this.gatherMoney}`);
	}
}
