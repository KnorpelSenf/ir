// Copyright (c) 2026 Marco Nikander

import * as MIR from "../middle/middle_grammar.ts";
import type {
  IndexedBlock,
  IndexedFunction,
  IndexedProgram,
} from "./types.gen.ts";

export function validate_and_index(program: MIR.Program): IndexedProgram {
  if (program[0] !== "program" || program.length < 2) {
    throw Error("Cannot lower an empty MIR program");
  }
  const functions = program.slice(1) as MIR.Function[];
  const parameter_counts = functions.map((func) => func[1].length - 1);
  return functions.map((func, id) =>
    validate_function(func, id, parameter_counts)
  );
}

function validate_function(
  func: MIR.Function,
  id: number,
  parameter_counts: number[],
): IndexedFunction {
  const parameter_count = func[1].length - 1;
  const resource_count = parameter_count + func[2].length - 1;
  const [, , , , ...source_blocks] = func;
  if (source_blocks.length === 0) {
    throw Error(`Function ${id} has no entry block`);
  }

  const defined = new Set<MIR.ResourceId>();
  const blocks: IndexedBlock[] = source_blocks.map((block, id) => ({
    id,
    bindings: block[1].slice(1) as MIR.ResourceId[],
    lines: block[2].slice(1) as MIR.Line[],
  }));

  const entry_bindings = blocks[0].bindings;
  if (
    entry_bindings.length !== parameter_count ||
    entry_bindings.some((binding, index) => binding !== MIR.resource_id(index))
  ) {
    throw Error(
      `Function ${id} must bind its entry parameters in canonical order`,
    );
  }

  function define(resource: MIR.ResourceId): void {
    check_resource(resource, resource_count, `destination in function ${id}`);
    if (defined.has(resource)) {
      throw Error(
        `Resource ${resource} is defined more than once in function ${id}`,
      );
    }
    defined.add(resource);
  }

  for (const block of blocks) {
    for (const binding of block.bindings) define(binding);
    for (const line of block.lines) {
      if (line[0] === "let") {
        define(line[1]);
        validate_operation(
          line[2],
          resource_count,
          parameter_counts,
        );
      } else if (line[0] === "drop") {
        check_resource(line[1], resource_count, `drop in function ${id}`);
      } else {
        validate_terminator(line, resource_count, blocks);
      }
    }
  }
  return { id, parameter_count, resource_count, blocks };
}

function validate_operation(
  op: MIR.Operation,
  resources: number,
  parameter_counts: number[],
): void {
  if (op[0] === "call") {
    check_function(op[1], parameter_counts.length);
    const arguments_ = op[2].slice(1) as MIR.Operand[];
    if (arguments_.length !== parameter_counts[MIR.to_index(op[1])]) {
      throw Error(`Argument count does not match function ${op[1]}`);
    }
    for (const operand of arguments_) {
      validate_operand(operand, resources);
    }
  } else {
    for (const value of op.slice(1)) {
      validate_operand(value as MIR.Operand, resources);
    }
  }
}

function validate_terminator(
  line: MIR.Terminator,
  resources: number,
  blocks: IndexedBlock[],
): void {
  if (line[0] === "jump") validate_target(line[1], resources, blocks);
  else if (line[0] === "branch") {
    validate_operand(line[1], resources);
    validate_target(line[2], resources, blocks);
    validate_target(line[3], resources, blocks);
  } else check_resource(line[1], resources, "return");
}

function validate_target(
  target: MIR.Target,
  resources: number,
  blocks: IndexedBlock[],
): void {
  check_block(target[1], blocks.length);
  const arguments_ = target[2].slice(1) as MIR.Operand[];
  if (arguments_.length !== blocks[MIR.to_index(target[1])].bindings.length) {
    throw Error(`Argument count does not match bindings of block ${target[1]}`);
  }
  for (const operand of arguments_) validate_operand(operand, resources);
}

function validate_operand(operand: MIR.Operand, resources: number): void {
  if (operand[0] !== "constant") {
    check_resource(operand[1], resources, "operand");
  }
}

function check_resource(
  resource: MIR.ResourceId,
  count: number,
  context: string,
): void {
  const index = MIR.to_index(resource);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw Error(`Invalid resource ${resource} in ${context}`);
  }
}
function check_block(block: MIR.BlockId, count: number): void {
  const index = MIR.to_index(block);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw Error(`Invalid block id ${block}`);
  }
}
function check_function(function_: MIR.FunctionId, count: number): void {
  const index = MIR.to_index(function_);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw Error(`Invalid function id ${function_}`);
  }
}
