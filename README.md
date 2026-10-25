# Intermediate Representation

An interpreter for a memory-safe intermediate representation (IR). This IR is
inspired by WebAssembly, LLVM IR, MLIR, and Rust MIR. It combines static
single-assignment form, the single ownership principle, and integrates
references directly into static single-assignment (SSA) form. The
[**language concept paper**](doc/language_concept.md) explains the ideas behind
the IR and its approach to memory-safety. A
[primer on SSA](doc/intro_to_ssa_form.md) form is also available.

The IR sits between high-level languages such as C or TypeScript on one end, and
Assembly on the other end. It is based on 3-address code (3AC or TAC). This
project contains middle ([MIR](src/middle/middle_grammar.ts)) and low
([LIR](src/low/low_grammar.ts)) intermediate representations. MIR is the focus
of the project. Its written in
[symbolic expressions](https://en.wikipedia.org/wiki/S-expression), has type
information, and is intended for program analysis. The static analysis of MIR is
a work-in-progress. LIR is close to assembly and is used for execution on a
virtual [machine](src/low/machine.ts).

Programs are constructed directly as tagged tuples in TypeScript and checked by
the type checker. There is no parser. MIR has a pretty-printer for readable test
fixtures and debugging.

The MIR-to-LIR compilation pipeline is completely AI-generated, from
human-defined interfaces and human-defined end-to-end tests. It uses a
micro-pass architecture inspired by the Chez Scheme compiler.

## More Information

| File / Directory                                     | Description                          |
| ---------------------------------------------------- | ------------------------------------ |
| [instructions.md](./doc/instructions.md)             | Table of instructions and operations |
| [decisions.md](./doc/decisions.md)                   | Log of design decisions              |
| [intro_to_ssa_form.md](./doc/intro_to_ssa_form.md)   | Introduction to SSA form             |
| [**language_concept.md**](./doc/language_concept.md) | Whitepaper for the language          |

## Getting Started

This project is implemented in TypeScript, using [Deno](https://deno.com/).
After setting up Deno, install the required dependencies, and run the tests
with:

```bash
cd ir/
deno install
deno test
```

Currently, there is no command-line interface, only tests.

## MIR Syntax

An MIR program is an array of functions, with `@0` as its entry point. In the
[block-parameter grammar](src/middle/middle_grammar.ts), numeric IDs identify
resources (`%N`), functions (`@N`), and blocks (`^N`) by their zero-based
positions. Function IDs are program-wide; block and resource IDs are local to a
function. Resources are stack-frame slots, numbered with parameters first, then
locals.

This function adds 42 to its `Int` parameter, passes the result to a second
block, and returns it:

```text
(program
  (function
    (parameters Int)
    (locals Int Int)
    (result Int)
    (block
      (bindings %0)
      (instructions
        (let %1 (add (peek %0) (constant 42)))
        (jump (target ^1 (arguments (peek %1))))))
    (block
      (bindings %2)
      (instructions
        (return %2)))))
```

Function bodies use five instruction forms:

| Form                             | Meaning                                      |
| -------------------------------- | -------------------------------------------- |
| `(let RESOURCE OPERATION)`       | Define a resource with an operation's result |
| `(drop RESOURCE)`                | Destroy a resource                           |
| `(return RESOURCE)`              | Return a resource's value from the function  |
| `(jump TARGET)`                  | Jump unconditionally to a block              |
| `(branch OPERAND TARGET TARGET)` | Choose a target based on a condition         |

Every value-producing operation appears on the right-hand side of a `let`.
Operands are `(peek %N)` for non-consuming access, `(move %N)` for a destructive
move, and `(constant N)` for an immediate integer. The `identity` operation
copies an operand as-is; `call` uses `(call @N (arguments OPERAND...))`. See the
[instruction reference](doc/instructions.md) for the full operation catalog and
type signatures.

### Blocks and Argument Binding

A block has the structure
`(block (bindings RESOURCE...) (instructions LINE...))`. Incoming arguments bind
to the listed resources in order before the first instruction, like
let-bindings. The function's `parameters` and `locals` lists declare resource
types, and `result` declares its return type.

The first block binds function arguments to their canonical parameter IDs:
`(bindings %0 %1)` for two parameters, or `(bindings)` for none. Other blocks
can bind any declared resource IDs. Calls must supply exactly the declared
number of parameters.

Each control-flow edge is `(target BLOCK (arguments OPERAND...))`. Branch
targets can pass different arguments to their successors. Every edge must supply
exactly one operand per destination binding, including edges not taken at
runtime. Each resource has one static definition, either a binding or a `let`;
that definition may execute repeatedly in a loop.

A jump captures all arguments before writing destination bindings. A branch
evaluates its condition first, then captures only the chosen target's arguments.
This preserves repeated sources and cyclic transfers: the following edge swaps
`%0` and `%1` when the destination has `(bindings %0 %1)`:

```text
(jump (target ^1 (arguments (peek %1) (peek %0))))
```

For argument transfers, `move` consumes its source after capture and before
bindings are written. Runtime rules reject writing into a destroyed slot;
support for consuming and later rebinding a block resource remains deferred, as
does coverage of pointers passed as block arguments.

### Symbolic expressions vs. JSON

Symbolic expressions and JSON arrays have identical tagged structure, allowing
direct translation for test fixtures:

```text
(let %2 (add (peek %0) (peek %1)))
["let", "%2", ["add", ["peek", "%0"], ["peek", "%1"]]]
```

### Formatting

As shown in the program above, the printer uses two-space indentation, expands
structural nodes, and keeps instructions and operands inline. Empty blocks print
`(bindings)` and `(instructions)` explicitly. Closing parentheses follow the
final child on the same line, and a complete printed program has a leading and
trailing newline.

## Source Layout

### Middle Intermediate Representation (MIR)

| File / Directory                                  | Description                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [middle_grammar.ts](src/middle/middle_grammar.ts) | Defines MIR programs, functions, blocks, instructions, operands, and tagged structural nodes. |
| [types.ts](src/middle/types.ts)                   | Defines MIR value and ownership types.                                                        |
| [print.gen.ts](src/middle/print.gen.ts)           | Pretty-prints MIR programs as canonical, indented symbolic expressions.                       |

### MIR Analysis

| File / Directory                                            | Description                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| [address_taken.ts](src/analysis/address_taken.ts)           | Collects borrowed resource IDs from block instructions.           |
| [control_flow_graph.ts](src/analysis/control_flow_graph.ts) | Builds predecessor and successor lists from control-flow targets. |
| [pointer_return.ts](src/analysis/pointer_return.ts)         | Checks whether the declared result type contains a borrow.        |

### MIR-to-LIR Lowering (AI-generated)

The pipeline has three passes: validation and indexing, operation and argument
lowering, and target resolution.

| File / Directory                                                         | Description                                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [lower.gen.ts](src/middle_to_low/lower.gen.ts)                           | The pipeline entry point. Runs micro-passes in order.                                        |
| [validate_and_index.gen.ts](src/middle_to_low/validate_and_index.gen.ts) | 1. Validates references, definitions, and argument counts; indexes functions and blocks.     |
| [lower_operations.gen.ts](src/middle_to_low/lower_operations.gen.ts)     | 2. Lowers operations, operands, and block argument transfers into LIR with symbolic targets. |
| [resolve_targets.gen.ts](src/middle_to_low/resolve_targets.gen.ts)       | 3. Resolves function and block targets to concrete instruction addresses.                    |
| [mod.gen.ts](src/middle_to_low/mod.gen.ts)                               | Exports the individual passes.                                                               |
| [types.gen.ts](src/middle_to_low/types.gen.ts)                           | Defines intermediate forms for passes.                                                       |

Notes:

- Unconditional jumps transfer arguments inline.
- Branch arms with arguments use separate generated LIR blocks so only the
  chosen arm performs its transfers; arms without arguments jump directly.
- Transfers capture inputs in temporary slots before writing bindings,
  preserving cyclic assignments.
- Temporary slots stay live across loop iterations.

### Low-Level IR and Runtime

| File / Directory                         | Description                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [low_grammar.ts](src/low/low_grammar.ts) | Defines flat LIR programs and instructions, numeric stack offsets, and concrete control-flow targets. |
| [machine.ts](src/low/machine.ts)         | Executes LIR programs and returns a plain `number`.                                                   |
| [stack.ts](src/low/stack.ts)             | Implements runtime values, pointers, dead slots, and pointer generations.                             |
| [utility.ts](src/utility.ts)             | Provides shared helpers such as `valid()`.                                                            |

### Tests

| File / Directory                                                       | Description                                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [middle.test.ts](test/middle/middle.test.ts)                           | End-to-end MIR tests for literals, exit, register copying, and arithmetic.    |
| [control_flow.test.ts](test/middle/control_flow.test.ts)               | End-to-end MIR tests for jumps, branches, loops, and block bindings.          |
| [functions.test.ts](test/middle/functions.test.ts)                     | End-to-end MIR tests for function calls.                                      |
| [memory.test.ts](test/middle/memory.test.ts)                           | End-to-end MIR tests for memory and ownership.                                |
| [print.gen.test.ts](test/middle/print.gen.test.ts)                     | MIR pretty-printer coverage.                                                  |
| [address_taken.test.ts](test/analysis/address_taken.test.ts)           | Tests borrowed resource ID collection with literal MIR fixtures.              |
| [control_flow_graph.test.ts](test/analysis/control_flow_graph.test.ts) | Tests control-flow predecessor and successor lists with literal MIR fixtures. |
| [pointer_return.test.ts](test/analysis/pointer_return.test.ts)         | Tests pointer-return detection from declared MIR result types.                |
| [passes.gen.test.ts](test/middle_to_low/passes.gen.test.ts)            | MIR-to-LIR micro-pass tests.                                                  |
| [runtime.test.ts](test/low/runtime.test.ts)                            | Direct LIR runtime tests.                                                     |

### Other Repository Areas

| File / Directory | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| [doc/](doc/)     | Instruction reference and design decisions.                                  |
| [id/](id/)       | Utilities and state for generating unique design-decision and invariant IDs. |

## Commit Message Hook

This repo includes a tracked `commit-msg` hook in `.githooks/` that enforces
commit messages to start with one of these tags:

- `impl` for implementations of features
- `gen` for AI-generated features
- `fix`
- `ref` for refactoring
- `test`
- `doc`
- `tool` for linters, git config, CI/CD etc
- `proto` for prototyping (could also use impl/gen instead)

Enable it once per clone with:

```sh
git config core.hooksPath .githooks
chmod +x .githooks/commit-msg
```

Accepted examples:

```text
impl: stack underflow check
fix: correct program counter update
doc: clarify SSA invariants
```

---

**Copyright (c) 2026 Marco Nikander**
