import { NS } from '@ns';

export async function main(ns: NS) {
  let input: [number, number][] = [
    [13, 21],
    [18, 24],
    [21, 29],
    [6, 12],
    [24, 28],
    [17, 26],
    [14, 17],
    [14, 17],
    [3, 11],
  ];

  while (true) {
    const output: [number, number][] = [];
    for (let i = 0; i < input.length; i += 1) {
      let doesOverlap = false;
      for (let j = 0; j < output.length; j += 1) {
        doesOverlap = overlaps(input[i], output[j]);
        if (doesOverlap) {
          output[j] = merge(input[i], output[j]);
          break;
        }
      }
      if (!doesOverlap) {
        output.push(input[i]);
      }
    }

    if (input.length === output.length) {
      ns.tprint(output.sort(([minA], [minB]) => minA - minB));
      return;
    }

    input = [...output];
  }
}

function overlaps([minA, maxA]: [number, number], [minB, maxB]: [number, number]): boolean {
  return !(minA > maxB || minB > maxA);
}

function merge([minA, maxA]: [number, number], [minB, maxB]: [number, number]): [number, number] {
  return [Math.min(minA, minB), Math.max(maxA, maxB)];
}
