// Copyright (c) 2026 Marco Nikander

import * as MIR from "../middle/middle_grammar.ts";
import * as LIR from "../low/low_grammar.ts";
import {
  lower_operations,
  resolve_targets,
  validate_and_index,
} from "./mod.gen.ts";

export function lower(program: MIR.Program): LIR.Program {
  const indexed = validate_and_index(program);
  const unresolved = lower_operations(indexed);
  return resolve_targets(unresolved);
}
