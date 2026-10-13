# MIR Instructions and Type Signatures

MIR uses tagged symbolic expressions defined in
[new_grammar.ts](../src/new/new_grammar.ts).
Resources (i.e. variables) are identified by `%` followed by their zero-based
position in their respective function.
Functions are identified by `@` followed by their zero-based position in the
program, and blocks by `^` followed by their zero-based position in their
containing `function` node.
A complete function has the following structure:

```text
(function
  (parameters Int)
  (locals Int (Borrowed Int))
  (result Int)
  (block
    (bindings %0)
    (instructions
      (let %1 (identity (constant 42)))
      (return %1))))
```

## Instructions

| Symbol   | Example                                    | Parameters                  | Comment                                                                |
| :------- | :----------------------------------        | :-------------------------- | :--------------------------------------------------------------------- |
| `let`    | `(let %0 (identity (constant 42)))`        | `Resource, Operation`       | Define resource %0 with the value 42                                   |
| `drop`   | `(drop %0)`                                | `Resource`                  | Destroy resource %0                                                    |
| `jump`   | `(jump (target ^1 (arguments (peek %0))))` | `Target`                    | Unconditional branch to block #1, passing resource %0                  |
| `branch` | `(branch (peek %0) (target ^1 (arguments (constant 42))) (target ^2 (arguments)))` | `Boolean, Target, Target` | Branch to block #1 with argument 42 when true, else block #2 with no arguments |
| `return` | `(return %0)`                              | `Resource`                         | Return the value of resource %0 from the function                      |

## Value-Producing Operations

Every value-producing operation is bound to a resource with:
`(let RESOURCE (OPERATION OPERANDS...))`
The right-hand side of a let-binding is always an operation.
The `identity` operation allows duplicating / copying a Value.

| Symbol          | Example                                                            | Input              | Output        | Comment                                |
| :-------------- | :----------------------------------------------------------------- | :----------------- | :------------ | :------------------------------------- |
| `call`          | `(let %0 (call @1 (arguments (peek %1) (move %2))))`               | `T...`             | `U`           | Function call                          |
| `borrow`        | `(let %0 (borrow (peek %1)))`                                      | `T`                | `Borrowed T`  | Create a read-only, non-owning pointer |
| `load`          | `(let %0 (load (peek %1)))`                                        | `Borrowed T`       | `T`           | Load the value referenced by a pointer |
| `identity`      | `(let %0 (identity (constant 42)))`                                | `T`                | `T`           | Copy an operand into a resource        |
| `add`           | `(let %0 (add (peek %1) (constant 2)))`                            | `Int, Int`         | `Int`         |                                        |
| `subtract`      | `(let %0 (subtract (peek %1) (move %2)))`                          | `Int, Int`         | `Int`         |                                        |
| `multiply`      | `(let %0 (multiply (peek %1) (constant 2)))`                       | `Int, Int`         | `Int`         |                                        |
| `divide`        | `(let %0 (divide (peek %1) (move %2)))`                            | `Int, Int`         | `Int`         |                                        |
| `remainder`     | `(let %0 (remainder (peek %1) (constant 2)))`                      | `Int, Int`         | `Int`         |                                        |
| `minimum`       | `(let %0 (minimum (peek %1) (move %2)))`                           | `Int, Int`         | `Int`         |                                        |
| `maximum`       | `(let %0 (maximum (peek %1) (constant 2)))`                        | `Int, Int`         | `Int`         |                                        |
| `negate`        | `(let %0 (negate (peek %1)))`                                      | `Int`              | `Int`         |                                        |
| `equal`         | `(let %0 (equal (peek %1) (constant 2)))`                          | `Int, Int`         | `Boolean`     |                                        |
| `unequal`       | `(let %0 (unequal (peek %1) (move %2)))`                           | `Int, Int`         | `Boolean`     |                                        |
| `less`          | `(let %0 (less (peek %1) (constant 2)))`                           | `Int, Int`         | `Boolean`     |                                        |
| `less_equal`    | `(let %0 (less_equal (peek %1) (move %2)))`                        | `Int, Int`         | `Boolean`     |                                        |
| `greater`       | `(let %0 (greater (peek %1) (constant 2)))`                        | `Int, Int`         | `Boolean`     |                                        |
| `greater_equal` | `(let %0 (greater_equal (peek %1) (move %2)))`                     | `Int, Int`         | `Boolean`     |                                        |

## Operands and References

The resource's type is supplied by the function's `parameters` and `locals` lists.
Operands can:

1. access a Resource via `peek`
2. access and destroy a Resource via `move`
3. use a temporary/immediate value via `constant`

| Symbol     | Example           | Meaning                                  |
| :--------- | :---------------- | :--------------------------------------- |
| `peek`     | `(peek %0)`       | Access resource %0 without consuming it  |
| `move`     | `(move %0)`       | Destructively move resource %0           |
| `constant` | `(constant 42)`   | Immediate integer value 42               |

Function and block references are written with the `@` and `^` sigils:
`@1` refers to the function at index 1 in the program, and `^2` refers to the
block at index 2 in the current function.

## Notes

- Boolean results and branch conditions are represented as `Int`, using 0 for
  false and 1 for true.
- MIR carries type annotations in `parameters`, `result`, and `locals`, but no
  MIR type checker is currently implemented.

---
**Copyright (c) 2026 Marco Nikander**
