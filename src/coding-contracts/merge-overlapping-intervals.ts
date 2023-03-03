import { NS } from '@ns';

class Node {
  index: number;
  neighboors: number[];
  color: number;

  constructor(index: number, neighboors: number[]) {
    this.index = index;
    this.neighboors = neighboors;
    this.color = -1;
  }
}

export async function main(ns: NS) {
  const [n, edges] = [
    11,
    [
      [5, 9],
      [1, 5],
      [6, 8],
      [6, 9],
      [1, 6],
      [0, 3],
      [5, 10],
      [6, 7],
      [3, 8],
      [8, 10],
      [5, 7],
      [5, 8],
      [3, 7],
      [0, 6],
      [0, 5],
      [3, 4],
    ],
  ];
  const graph: Node[] = [];
  for (let i = 0; i < n; i += 1) {
    graph.push(
      new Node(
        i,
        edges.flatMap(([from, to]) => {
          if (from === i) return [to];
          if (to === i) return [from];
          return [];
        }),
      ),
    );
  }

  let depth = 0;
  let queue: (Node | null)[] = [graph[0], null];
  let node: Node | null;

  while (queue.length > 0) {
    [node, ...queue] = queue;

    if (node === null) {
      if (queue.length === 0) break;

      depth += 1;
      queue.push(null);
      continue;
    }

    if (node.color >= 0) continue;

    // Set color
    node.color = depth % 2;

    // Stop if one of the neighboors has the same color
    if (
      node.neighboors
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        .map((index) => index !== node!.index && graph[index].color === node!.color)
        .some((hasSameColor) => hasSameColor)
    ) {
      ns.tprint('[]');
      return;
    }

    queue.push(...node.neighboors.flatMap((index) => (graph[index].color < 0 ? [graph[index]] : [])));
  }

  ns.tprint(graph.map(({ color }) => Math.max(0, color)));
}
