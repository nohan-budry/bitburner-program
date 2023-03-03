import { NS } from '@ns';

export async function main(ns: NS) {
  const input = '25525511135';
  if (input.length > 12) return [];

  for (let i = 1; i <= 3; i += 1) {
    ns.tprint('i: ', i);
    const one = input.slice(0, i);
    if (!isOK(ns, one)) continue;
    for (let j = 1; j <= 3; j += 1) {
      ns.tprint('j: ', j);
      const two = input.slice(i, i + j);
      if (!isOK(ns, two)) continue;
      for (let k = 1; k <= 3; k += 1) {
        ns.tprint('k: ', k);
        const three = input.slice(i + j, i + j + k);
        if (!isOK(ns, three)) continue;

        const four = input.slice(i + j + k);
        if (!isOK(ns, four)) continue;

        ns.tprint(`${one}.${two}.${three}.${four}`);
      }
    }
  }
}

function isOK(ns: NS, value: string): boolean {
  const n = Number(value);
  const ok =
    !Number.isNaN(n) &&
    Number.isFinite(n) &&
    Number.isInteger(n) &&
    n > 0 &&
    n <= 255 &&
    !value.startsWith('0') &&
    value.length <= 3;
  return ok;
}
