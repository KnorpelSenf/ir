# Intermediate Representation

An interpreter for an intermediate representation (IR). This IR is inspired by
WebAssembly, LLVM IR, MLIR, and Rust MIR. It is based on 3-address code (3AC aka
TAC). Like all IRs, it sits between high-level languages such as C or TypeScript
on one end, and Assembly on the other end.

This project contains middle ([MIR](src/new/new_grammar.ts)) and low
([LIR](src/low/low_grammar.ts)) intermediate representations. MIR is based on
symbolic expressions, has type information, and is intended for program
analysis. LIR is close to assembly and is used for execution on a virtual
[machine](src/low/machine.ts).

Programs are constructed directly as tagged tuples in TypeScript and checked by
the type checker. There is no parser. MIR has a pretty-printer for readable test
fixtures and debugging.

The MIR-to-LIR compilation pipeline is completely AI-generated, from
human-defined interfaces and human-defined end-to-end tests. It uses a
micro-pass architecture inspired by the Chez Scheme compiler.

## More Information

| File / Directory                         | Description                          |
| ---------------------------------------- | ------------------------------------ |
| [instructions.md](./doc/instructions.md) | Table of instructions and operations |
| [decisions.md](./doc/decisions.md)       | Log of design decisions              |

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

The examples below use the block-parameter grammar in
[new_grammar.ts](src/new/new_grammar.ts).

Overall, an MIR program is an array of functions, where the function with index
0 serves as the entry point or 'main' function.

In MIR, all functions, code blocks, and resources (i.e. variables) are
identified by a sigil prefix and numeric id, instead of a name. The sigil `%` is
for resources, `@` for functions, and `^` for blocks. Although the numeric ids
decrease human readability, they simplify the analysis and processing for which
MIR is intended. The resources in a function are essentially slots in the stack
frame. The parameters come first, starting at index 0, followed by the local
variables. For example, a function which takes 2 parameters and has 3 local
variables, has:

- parameters with ids 0 and 1
- local variables with ids 2, 3, and 4

A very simple example of an MIR program is given by:

```
(program
  (function
    (parameters)
    (locals Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 13)))
        (let %1 (identity (constant 42)))
        (return %1)))))
```

This defines an MIR program with a single function. That function takes no
parameters, has two local resources of type `Int` and returns a result of type
`Int`. The function consists of a single block of code. That block of code
defines resource #0 to have the constant value 13, defines resource #1 to have
value 42, and returns resource #1. The right-hand side of a let-binding is
always an operation. The `identity` function simply takes a value as it is.

Overall, there are five fundamental syntactic forms in the body of an MIR
function. They are illustrated by these examples:

- `(let %0 (identity (constant 42)))` defines resource #0 with the value 42.
- `(drop %0)` drops resource #0.
- `(return %0)` returns resource #0 from the function.
- `(jump (target ^1 (arguments)))` jumps to block #1 unconditionally without
  arguments.
- `(branch (peek %0) (target ^1 (arguments)) (target ^2 (arguments)))` branches
  conditionally without arguments.

Every value-producing line takes the form of a let-binding. The general form is
`(let RESOURCE OPERATION)`. For example:

- `(let %0 (identity (constant 42)))` loads the integer `42` into resource 0.
- `(let %1 (add (peek %0) (move %2)))` adds two operands and binds the result to
  resource 1.
- `(let %2 (call @1 (arguments (peek %0))))` calls function #1, passes resource
  #0 as an argument, and binds the result to resource #2.

Operands are `(peek %N)` for non-consuming access, `(move %N)` for a destructive
move, and `(constant N)` for an immediate integer. Block and function references
are written as `^N` and `@N`.

Every block contains an explicit `bindings` node followed by an `instructions`
node. Incoming arguments bind to the listed resource IDs in order, like
let-bindings evaluated before the first instruction. A function's first block
binds its incoming function arguments; a function with two parameters starts
with `(bindings %0 %1)`. The function's `parameters` and `locals` still declare
the resource types. Entry bindings must use the canonical parameter IDs in
order; other blocks can bind any declared resource IDs. Control-flow joins use
MLIR-inspired block bindings: each predecessor passes its operands to the
receiving block.

All arguments on the chosen edge are captured before any destination binding is
written. For example, passing `(peek %1) (peek %0)` to `(bindings %0 %1)` swaps
the two values. A branch evaluates its condition first and evaluates only the
selected target's arguments. Each target must supply exactly as many arguments
as its destination has bindings, and calls must match their function's parameter
count.

Each resource has one static definition, either a block binding or a `let`.
Repeated execution of that definition in a loop is allowed; defining the same
resource in two places is rejected.

Each control-flow edge carries a `target` containing the destination block and
its own `arguments` node. A branch can pass different arguments to each
successor. For example:

```text
(program
  (function
    (parameters Int)
    (locals Int)
    (result Int)
    (block
      (bindings %0)
      (instructions
        (jump (target ^1 (arguments (peek %0))))))
    (block
      (bindings %1)
      (instructions
        (return %1)))))
```

### Symbolic expressions vs. JSON

The notation between symbolic expressions and JSON is slightly different. For
MIR, both notations are designed to have identical structure. Having a
straight-forward translation step makes it easier to reason about and write
test-cases in either form.

```text
(let %2 (add (peek %0) (peek %1)))
["let", "%2", ["add", ["peek", "%0"], ["peek", "%1"]]]

(jump (target ^1 (arguments (peek %0))))
["jump", ["target", "^1", ["arguments", ["peek", "%0"]]]]

(branch (peek %0) (target ^1 (arguments (constant 42))) (target ^2 (arguments)))
["branch", ["peek", "%0"], ["target", "^1", ["arguments", ["constant", 42]]], ["target", "^2", ["arguments"]]]

(block
  (bindings %1)
  (instructions
    (return %1)))
["block", ["bindings", "%1"], ["instructions", ["return", "%1"]]]
```

### Formatting

The printer uses two-space indentation, expands structural nodes, and keeps
instructions and operands inline. Empty blocks print `(bindings)` and
`(instructions)` explicitly. Closing parentheses follow the final child on the
same line, and the complete printed program has a leading and trailing newline.
Example of canonical formatting:

```text
(program
  (function
    (parameters Int)
    (locals (Borrowed Int) Int Int Int)
    (result Int)
    (block
      (bindings %0)
      (instructions
        (let %1 (borrow (peek %0)))
        (let %2 (load (move %1)))
        (branch (constant 0) (target ^1 (arguments (move %2))) (target ^2 (arguments (constant 42))))))
    (block
      (bindings %3)
      (instructions
        (return %3)))
    (block
      (bindings %4)
      (instructions
        (return %4)))))
```

## Source Layout

### Middle Intermediate Representation (MIR)

| File / Directory                         | Description                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| [new_grammar.ts](src/new/new_grammar.ts) | Defines MIR programs, functions, blocks, instructions, operands, and tagged structural nodes. |
| [types.ts](src/new/types.ts)             | Defines MIR value and ownership types.                                                        |
| [print.gen.ts](src/new/print.gen.ts)     | Pretty-prints MIR programs as canonical, indented symbolic expressions.                       |

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

| File / Directory                                            | Description                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| [middle.test.ts](test/new/middle.test.ts)                   | End-to-end MIR tests for literals, exit, register copying, and arithmetic. |
| [control_flow.test.ts](test/new/control_flow.test.ts)       | End-to-end MIR tests for jumps, branches, loops, and block bindings.       |
| [functions.test.ts](test/new/functions.test.ts)             | End-to-end MIR tests for function calls.                                   |
| [memory.test.ts](test/new/memory.test.ts)                   | End-to-end MIR tests for memory and ownership.                             |
| [print.gen.test.ts](test/new/print.gen.test.ts)             | MIR pretty-printer coverage.                                               |
| [passes.gen.test.ts](test/middle_to_low/passes.gen.test.ts) | MIR-to-LIR micro-pass tests.                                               |
| [runtime.test.ts](test/low/runtime.test.ts)                 | Direct LIR runtime tests.                                                  |

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
