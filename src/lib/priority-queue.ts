export interface PQNode {
  get priority(): number;
}

export class PriorityQueue<Node extends PQNode> {
  public nodes: Node[] = [];

  public isEmpty() {
    return this.nodes.length === 0;
  }

  public peek() {
    return this.nodes[this.nodes.length - 1];
  }

  public enqueue(node: Node) {
    for (let i = 0; i < this.nodes.length; i += 1) {
      if (node.priority > this.nodes[i].priority) {
        this.nodes.splice(i, 0, node);
        return;
      }
    }

    this.nodes.push(node);
  }

  public dequeue() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.nodes.pop()!;
  }
}
