import { NS } from '@ns';
import { Display } from './lib/display';
import { PQNode, PriorityQueue } from './lib/priority-queue';
import { AutocompleteData, Command, Program } from './lib/program';
import { bfsServers } from './lib/scan-servers';
import { PodService } from './services/pod.service';

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

enum Event {
  WAIT = 0,
  MANAGE_PODS,
  UPDATE_SERVERS,
}

class EventPQNode implements PQNode {
  public event: Event;
  public readyTime: number;

  constructor(event: Event, readyTime: number) {
    this.event = event;
    this.readyTime = readyTime;
  }

  get priority(): number {
    return this.readyTime;
  }
}

class BurnerProgran extends Program {
  podService!: PodService;

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
  }

  async start() {
    const eventQueue = new PriorityQueue<EventPQNode>();
    let time = 0;

    // Add base events
    eventQueue.enqueue(new EventPQNode(Event.MANAGE_PODS, 0));

    // Execute events
    while (true) {
      // Add a wait event  if the queue is empty;
      if (eventQueue.isEmpty()) throw `No more event available!`;
      this.display.debug('Event Queue: ', eventQueue);

      const { event, readyTime } = eventQueue.dequeue();
      const waitDuration = Math.max(readyTime - time, 1000);

      // Waits for the event to be ready
      this.display.debug(`Waiting for ${this.ns.tFormat(waitDuration)}`);
      await this.ns.sleep(waitDuration);
      time += waitDuration;

      // Execute Event
      this.display.debug(`Executing event: ${event}`);
      switch (event) {
        case Event.WAIT:
          break;
        case Event.MANAGE_PODS:
          {
            const waitDurationBeforeNextEvent = this.managePods();
            this.display.debug(`Waiting before next pod managment event: ${waitDurationBeforeNextEvent}`);
            if (waitDurationBeforeNextEvent >= 0.0) {
              eventQueue.enqueue(new EventPQNode(Event.MANAGE_PODS, time + waitDurationBeforeNextEvent));
            }
          }
          break;
          case Event.UPFATE_SERVERS:
            if (this.takeOver) eventQueue.enqueue(new EventPQNode(Event.UPDATE_SERVERS, time + 60000));
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

  private takeOver(): boolean {
    bfsServers(this.ns, this.ns.getHostname(), (server) => {

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
}
