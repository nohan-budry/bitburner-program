import { Display } from '@/lib/display';
import { NS } from '@ns';

export class Service {
  ns: NS;
  display: Display;

  constructor(ns: NS, display: Display) {
    this.ns = ns;
    this.display = display;
  }
}
