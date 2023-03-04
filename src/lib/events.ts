import { NS } from '@ns';
import { Display } from './display';
import { PriorityQueue, PQNode } from './priority-queue';

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

export class EventManager {
  private ns: NS;
  private display: Display;
  private queue = new PriorityQueue<EventPQNode>();
  private time = 0;

  constructor(ns: NS, display: Display) {
    this.ns = ns;
    this.display = display;
  }

  public scheduleEvent(event: Event, cooldown: number) {
    this.queue.enqueue(new EventPQNode(event, this.time + cooldown));
  }

  public async waitForNextEvent() {
    if (this.queue.isEmpty()) return null;

    const eventNode = this.queue.dequeue();
    const waitDuration = Math.max(eventNode.readyTime - this.time, 1000);

    // Waits for the event to be ready
    this.display.debug(`Waiting for ${this.ns.tFormat(waitDuration)}`);
    await this.ns.sleep(waitDuration);
    this.time += waitDuration;

    return eventNode.event;
  }
}

export enum EventType {
  MANAGE_PODS = 0,
  UPDATE_SERVERS,
  SIMPLE_HACK,
}

export abstract class Event {
  public type: EventType;

  constructor(type: EventType) {
    this.type = type;
  }
}

export class ManagePodsEvent extends Event {
  constructor() {
    super(EventType.MANAGE_PODS);
  }
}

export class UpdateServersEvent extends Event {
  constructor() {
    super(EventType.UPDATE_SERVERS);
  }
}

export class SimpleHackEvent extends Event {
  constructor() {
    super(EventType.SIMPLE_HACK);
  }
}
