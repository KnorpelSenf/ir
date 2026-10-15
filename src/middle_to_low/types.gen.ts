// Copyright (c) 2026 Marco Nikander

import * as MIR from "../middle/middle_grammar.ts";
import * as LIR from "../low/low_grammar.ts";

export type IndexedProgram = readonly IndexedFunction[];
export type IndexedFunction = {
  id: number;
  parameter_count: number;
  resource_count: number;
  blocks: IndexedBlock[];
};
export type IndexedBlock = {
  id: number;
  bindings: MIR.ResourceId[];
  lines: MIR.Line[];
};

export type BlockTarget = { function_id: number; block_id: number };
export type FunctionTarget = { function_id: number };
export type UnresolvedJump = [null, "jump", BlockTarget];
export type UnresolvedBranch = [
  null,
  "branch",
  LIR.Offset,
  [BlockTarget, BlockTarget],
];
export type UnresolvedCall = [
  LIR.Offset,
  "call",
  FunctionTarget,
  LIR.Offset[],
  string,
];
export type UnresolvedInstruction =
  | Exclude<LIR.Instruction, LIR.Jump | LIR.Branch | LIR.Call>
  | UnresolvedJump
  | UnresolvedBranch
  | UnresolvedCall;
export type UnresolvedProgram = readonly UnresolvedInstruction[];
