import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import * as MIR from "../../src/middle/middle_grammar.ts";
import { print } from "../../src/middle/print.gen.ts";
import { lower } from "../../src/middle_to_low/lower.gen.ts";
import { evaluate } from "../../src/low/machine.ts";

describe("MIR: pointers", () => {
  it("must create and load a pointer", () => {
    const text: string = `
(program
  (function
    (parameters)
    (locals Int (Borrowed Int) Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (let %1 (borrow (peek %0)))
        (let %2 (load (peek %1)))
        (return %2)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Borrowed", ["Int"]], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 11]]],
            ["let", "%1", ["borrow", ["peek", "%0"]]],
            ["let", "%2", ["load", ["peek", "%1"]]],
            ["return", "%2"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    expect(evaluate(lower(input))).toBe(11);
  });

  it.skip("must support pointers as block arguments", () => {
    // TODO
  });

  it("must accept define-and-drop of a borrow in only one branch", () => {
    // This unit test is specifically intended for static analysis. It is an
    // example of a valid program which a borrow-checker might detect as a
    // false positive. The state of %2, which is a borrow, is 'Undefined' in one
    // branch and 'Destroyed' in another. In both cases there is no cleanup
    // obligation left over. If the state is treated as 'Ambiguous' in the final
    // block where the return tries to clean it up, this may result in a 'Use'
    // of %1, which was dropped in both branches, and would trigger an error.
    // The desired behavior is that the static analysis allows this example to
    // pass.
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int (Borrowed Int))
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 1)))
        (let %1 (identity (constant 42)))
        (branch (peek %0) (target ^1 (arguments)) (target ^2 (arguments)))))
    (block
      (bindings)
      (instructions
        (drop %1)
        (jump (target ^3 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %2 (borrow (peek %1)))
        (drop %2)
        (drop %1)
        (jump (target ^3 (arguments)))))
    (block
      (bindings)
      (instructions
        (return %0)))))
`;

    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"], ["Borrowed", ["Int"]]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 1]]],
            ["let", "%1", ["identity", ["constant", 42]]],
            [
              "branch",
              ["peek", "%0"],
              ["target", "^1", ["arguments"]],
              ["target", "^2", ["arguments"]],
            ],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["drop", "%1"],
            ["jump", ["target", "^3", ["arguments"]]],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%2", ["borrow", ["peek", "%1"]]],
            ["drop", "%2"],
            ["drop", "%1"],
            ["jump", ["target", "^3", ["arguments"]]],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["return", "%0"],
          ],
        ],
      ],
    ];

    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    expect(evaluate(lower(input))).toBe(1);
  });
});

describe.skip("MIR: use-after-free", () => {
  it("must detect a use-after-free in a return", () => {
    const text: string = `
(program
  (function
    (parameters)
    (locals Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 0)))
        (drop %0)
        (return %0)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 0]]],
            ["drop", "%0"],
            ["return", "%0"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    expect(() => evaluate(lower(input))).toThrow(); // runtime must flag this as an error
  });

  it("must detect a use-after-free in an arithmetic expression", () => {
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 0)))
        (drop %0)
        (let %1 (negate (peek %0)))
        (return %1)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 0]]],
            ["drop", "%0"],
            ["let", "%1", ["negate", ["peek", "%0"]]],
            ["return", "%1"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    expect(() => evaluate(lower(input))).toThrow(); // runtime must flag this as an error
  });

  it("must detect a double-free", () => {
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (drop %0)
        (drop %0)
        (let %1 (identity (constant 11)))
        (return %1)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 11]]],
            ["drop", "%0"],
            ["drop", "%0"],
            ["let", "%1", ["identity", ["constant", 11]]],
            ["return", "%1"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    expect(() => evaluate(lower(input))).toThrow(); // runtime must flag this as an error
  });

  it("must detect a use-after-move", () => {
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (let %1 (identity (move %0)))
        (return %0)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 11]]],
            ["let", "%1", ["identity", ["move", "%0"]]],
            ["return", "%0"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    expect(() => evaluate(lower(input))).toThrow(); // runtime must flag this as an error
  });

  it("must detect a dangling pointer when the source register is dropped", () => {
    const text: string = `
(program
  (function
    (parameters)
    (locals Int (Borrowed Int) Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (let %1 (borrow (peek %0)))
        (drop %0)
        (let %2 (load (peek %1)))
        (return %2)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Borrowed", ["Int"]], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 11]]],
            ["let", "%1", ["borrow", ["peek", "%0"]]],
            ["drop", "%0"],
            ["let", "%2", ["load", ["peek", "%1"]]],
            ["return", "%2"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    expect(() => evaluate(lower(input))).toThrow(); // runtime must flag this as an error
  });

  it("must detect a dangling pointer when the source register is moved", () => {
    const text: string = `
(program
  (function
    (parameters)
    (locals Int (Borrowed Int) Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (let %1 (borrow (peek %0)))
        (let %2 (identity (move %0)))
        (let %3 (load (peek %1)))
        (return %3)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Borrowed", ["Int"]], ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 11]]],
            ["let", "%1", ["borrow", ["peek", "%0"]]],
            ["let", "%2", ["identity", ["move", "%0"]]],
            ["let", "%3", ["load", ["peek", "%1"]]],
            ["return", "%3"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    expect(() => evaluate(lower(input))).toThrow(); // runtime must flag this as an error
  });
});
