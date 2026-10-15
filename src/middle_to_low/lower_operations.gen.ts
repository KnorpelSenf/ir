// Copyright (c) 2026 Marco Nikander

import * as MIR from "../middle/middle_grammar.ts";
import * as LIR from "../low/low_grammar.ts";
import type {
  BlockTarget,
  IndexedBlock,
  IndexedProgram,
  UnresolvedInstruction,
  UnresolvedProgram,
} from "./types.gen.ts";

export function lower_operations(
  program: IndexedProgram,
): UnresolvedProgram {
  const output: UnresolvedInstruction[] = [];
  for (const func of program) {
    let next_temporary = func.resource_count;
    const context: Context = {
      function_id: func.id,
      blocks: func.blocks,
      next_block: func.blocks.length,
      edges: [],
    };
    output.push([null, "noop", `fun ${func.id} [${func.parameter_count}]`]);
    for (const block of func.blocks) {
      output.push([null, "noop", `block ${block.id}`]);
      for (const line of block.lines) {
        const lowered = lower_line(line, context, next_temporary);
        output.push(...lowered.instructions);
        next_temporary = lowered.next_temporary;
      }
    }
    output.push(...context.edges);
  }
  return output;
}

type Context = {
  function_id: number;
  blocks: IndexedBlock[];
  next_block: number;
  edges: UnresolvedInstruction[];
};

type Result = { instructions: UnresolvedInstruction[]; next_temporary: number };

function lower_line(line: MIR.Line, context: Context, next: number): Result {
  if (line[0] === "drop") {
    return {
      instructions: [[MIR.to_index(line[1]), "drop"]],
      next_temporary: next,
    };
  }
  if (line[0] === "jump") return lower_transfer(line[1], context, next);
  if (line[0] === "branch") {
    const prepared = prepare_operands([line[1]], next, "moves");
    next = prepared.next;
    const targets = [line[2], line[3]].map((target): BlockTarget => {
      const block_id = MIR.to_index(target[1]);
      if (target[2].length === 1) {
        return { function_id: context.function_id, block_id };
      }
      const edge_id = context.next_block++;
      const lowered = lower_transfer(target, context, next);
      next = lowered.next_temporary;
      context.edges.push(
        [null, "noop", `block ${edge_id}`],
        ...lowered.instructions,
      );
      return { function_id: context.function_id, block_id: edge_id };
    });
    return {
      instructions: [...prepared.before, ...prepared.after, [
        null,
        "branch",
        prepared.offsets[0],
        [targets[0], targets[1]],
      ]],
      next_temporary: next,
    };
  }
  if (line[0] === "return") {
    return {
      instructions: [[null, "return", MIR.to_index(line[1])]],
      next_temporary: next,
    };
  }
  return lower_let(line, next);
}

function lower_transfer(
  target: MIR.Target,
  context: Context,
  next: number,
): Result {
  const block_id = MIR.to_index(target[1]);
  const bindings = context.blocks[block_id].bindings;
  // Snapshot the chosen edge before consuming sources or writing bindings.
  const prepared = prepare_operands(
    target[2].slice(1) as MIR.Operand[],
    next,
    "all",
  );
  const writes: UnresolvedInstruction[] = bindings.map((
    binding,
    index,
  ) => [MIR.to_index(binding), "copy", prepared.offsets[index]]);
  return {
    instructions: [...prepared.before, ...prepared.after, ...writes, [
      null,
      "jump",
      {
        function_id: context.function_id,
        block_id,
      },
    ]],
    next_temporary: prepared.next,
  };
}

function lower_let(line: MIR.Let, next: number): Result {
  const destination = MIR.to_index(line[1]);
  const op = line[2];
  if (op[0] === "call") {
    const prepared = prepare_operands(op[2].slice(1) as MIR.Operand[], next);
    return {
      instructions: [...prepared.before, [
        destination,
        "call",
        { function_id: MIR.to_index(op[1]) },
        prepared.offsets,
        `fun ${MIR.to_index(op[1])}`,
      ], ...prepared.after],
      next_temporary: prepared.next,
    };
  }
  const operands = op.slice(1) as MIR.Operand[];
  const prepared = prepare_operands(operands, next);
  let instruction: UnresolvedInstruction;
  switch (op[0]) {
    case "identity":
      instruction = [destination, "copy", prepared.offsets[0]];
      break;
    case "borrow":
      instruction = [destination, "address_of", prepared.offsets[0]];
      break;
    case "load":
      instruction = [destination, "load", prepared.offsets[0]];
      break;
    case "negate":
      instruction = [destination, "negate", prepared.offsets[0]];
      break;
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "remainder":
    case "minimum":
    case "maximum":
    case "equal":
    case "unequal":
    case "less":
    case "less_equal":
    case "greater":
    case "greater_equal":
      instruction = [
        destination,
        op[0],
        prepared.offsets[0],
        prepared.offsets[1],
      ] as Exclude<LIR.Instruction, LIR.Jump | LIR.Branch | LIR.Call>;
      break;
  }
  return {
    instructions: [...prepared.before, instruction!, ...prepared.after],
    next_temporary: prepared.next,
  };
}

function prepare_operands(
  operands: MIR.Operand[],
  next: number,
  capture?: "moves" | "all",
): {
  before: UnresolvedInstruction[];
  offsets: number[];
  after: UnresolvedInstruction[];
  next: number;
} {
  const before: UnresolvedInstruction[] = [];
  const after: UnresolvedInstruction[] = [];
  const offsets = operands.map((operand) => {
    if (operand[0] === "constant") {
      const temporary = next++;
      before.push([temporary, "constant", { value: operand[1] }]);
      return temporary;
    }
    const source = MIR.to_index(operand[1]);
    if (operand[0] === "move") after.push([source, "drop"]);
    if (capture === "all" || (capture === "moves" && operand[0] === "move")) {
      const temporary = next++;
      before.push([temporary, "copy", source]);
      return temporary;
    }
    return source;
  });
  return { before, offsets, after, next };
}
