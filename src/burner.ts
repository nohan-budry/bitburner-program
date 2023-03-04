import { NS } from '@ns';
import { Display } from './lib/display';
import { EventManager, EventType, ManagePodsEvent, UpdateServersEvent } from './lib/events';
import { AutocompleteData, Command, Program } from './lib/program';
import { bfsServers } from './lib/scan-servers';
import { PodService } from './services/pod.service';
import { ServerService } from './services/server.service';

export async function main(ns: NS) {
  let debugMode = false;
  if (ns.args.length > 0 && ns.args[0] === '--debug') {
    ns.args.shift();
    debugMode = true;
  }
  const program = new BurnerProgran();
  program.initialise(ns, new Display(ns, debugMode));
  await program.execute(ns.args);
}

export function autocomplete(data: AutocompleteData, args: string[]) {
  if (args.length > 0 && args[0] === '--debug') {
    args.shift();
  }

  const program = new BurnerProgran();
  return program.autocomplete(data, args);
}

class BurnerProgran extends Program {
  podService!: PodService;
  serverService!: ServerService;

  constructor() {
    super();

    this.addCommand(new Command('start', this.start, [], 'start', 'Starts the burner main process.'));
  }

  protected get programName(): string {
    return 'Burner';
  }
  protected get programUsage(): string {
    return 'burner [--debug] <command>';
  }
  protected get programDescription(): string {
    return 'Main program automating the game.';
  }

  public override initialise(ns: NS, display: Display): void {
    super.initialise(ns, display);

    this.podService = new PodService(ns, display);
    this.serverService = new ServerService(ns, display);
  }

  async start() {
    const eventQueue = new EventManager(this.ns, this.display);

    // Add base events
    eventQueue.scheduleEvent(new ManagePodsEvent(), 0);
    eventQueue.scheduleEvent(new UpdateServersEvent(), 0);

    // Execute events
    while (true) {
      const event = await eventQueue.waitForNextEvent();
      if (event == null) throw `No more event available!`;

      // Execute Event
      this.display.debug(`Executing event: ${event}`);
      switch (event.type) {
        case EventType.MANAGE_PODS:
          {
            const waitDurationBeforeNextEvent = this.managePods();
            this.display.debug(`Waiting before next pod managment event: ${waitDurationBeforeNextEvent}`);
            if (waitDurationBeforeNextEvent >= 0.0) {
              eventQueue.scheduleEvent(new ManagePodsEvent(), waitDurationBeforeNextEvent);
            }
          }
          break;
        case EventType.UPDATE_SERVERS:
          if (this.updateServers()) eventQueue.scheduleEvent(new UpdateServersEvent(), 60000);
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

  private updateServers(): boolean {
    let shouldTakeOverAgain = false;
    bfsServers(this.ns, this.ns.getHostname(), (hostname) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let server = this.serverService.getServer(hostname)!;
      this.serverService.takeOverServer(server);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      server = this.serverService.getServer(hostname)!;
      this.serverService.updateScripts(server);

      shouldTakeOverAgain = shouldTakeOverAgain && server.hasAdminRights;
    });

    return shouldTakeOverAgain;
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
}
