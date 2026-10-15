// Copyright (c) 2026 Marco Nikander

import * as MIR from "../middle/middle_grammar.ts";

export type Graph = Node[];

export type Node = {
  pred: MIR.BlockId[];
  succ: MIR.BlockId[];
};

export function make_cfg(func: undefined | MIR.Function): Graph {
  if (func === undefined) {
    return [];
  } else {
    const [, , , , ...blocks] = func;
    const successors: MIR.BlockId[][] = blocks.map(
      extract_successors,
    );

    const predecessors: MIR.BlockId[][] = blocks.map((_b) => []); // initialize empty array
    for (let start = 0; start < blocks.length; ++start) {
      const ends: MIR.BlockId[] = successors[start];
      ends.forEach((e: MIR.BlockId) =>
        predecessors[MIR.to_index(e)].push(`^${start}`)
      );
    }

    // zip
    const result: Graph = blocks.map((_b, i) => {
      const node: Node = {
        pred: predecessors[i],
        succ: successors[i],
      };
      return node;
    });
    return result;
  }
}

function extract_successors(block: MIR.Block): MIR.BlockId[] {
  const [, , [, ...lines]] = block;
  if (lines.length <= 0) {
    return [];
  } else {
    const last_index: number = lines.length - 1;
    const line: MIR.Line = lines[last_index];
    if (line[0] === "return") {
      return [];
    } else if (line[0] === "branch") {
      return [line[2][1], line[3][1]];
    } else if (line[0] === "jump") {
      return [line[1][1]];
    } else {
      throw Error(
        `Expected terminator instruction. Cannot extract successor blocks from
         instruction of type '${line[0]}'.`,
      );
    }
  }
}
