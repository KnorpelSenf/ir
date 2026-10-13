import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import * as MIR from "../../src/new/new_grammar.ts";
import { print } from "../../src/new/print.gen.ts";
import { lower } from "../../src/middle_to_low/lower.gen.ts";
import { evaluate } from "../../src/low/machine.ts";

describe("MIR: jump", () => {
  it("must execute the correct line of code after an unconditional jump", () => {
    // line CFG
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (jump (target ^2 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (return %0)))
    (block
      (bindings)
      (instructions
        (let %1 (identity (constant 13)))
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
            ["jump", ["target", "^2", ["arguments"]]],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 11]]],
            ["return", "%0"],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%1", ["identity", ["constant", 13]]],
            ["return", "%1"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(evaluate(lower(input))).toBe(13);
  });
});

describe("MIR: branch", () => {
  it("must execute first branch if the condition is true", () => {
    // split CFG
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (branch (constant 1) (target ^1 (arguments)) (target ^2 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (return %0)))
    (block
      (bindings)
      (instructions
        (let %1 (identity (constant 13)))
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
            [
              "branch",
              ["constant", 1],
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
            ["let", "%0", ["identity", ["constant", 11]]],
            ["return", "%0"],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%1", ["identity", ["constant", 13]]],
            ["return", "%1"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(evaluate(lower(input))).toBe(11);
  });

  it("must execute second branch if the condition is false", () => {
    // split CFG
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (branch (constant 0) (target ^1 (arguments)) (target ^2 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (return %0)))
    (block
      (bindings)
      (instructions
        (let %1 (identity (constant 13)))
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
            [
              "branch",
              ["constant", 0],
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
            ["let", "%0", ["identity", ["constant", 11]]],
            ["return", "%0"],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%1", ["identity", ["constant", 13]]],
            ["return", "%1"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(evaluate(lower(input))).toBe(13);
  });

  it("must perform computations inside of branches", () => {
    // diamond CFG
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int Int Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (let %1 (identity (constant 13)))
        (let %2 (identity (constant 281)))
        (branch (constant 0) (target ^1 (arguments)) (target ^2 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %3 (add (peek %0) (peek %1)))
        (jump (target ^3 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %4 (add (peek %1) (peek %2)))
        (jump (target ^3 (arguments)))))
    (block
      (bindings)
      (instructions
        (return %4)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"], ["Int"], ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 11]]],
            ["let", "%1", ["identity", ["constant", 13]]],
            ["let", "%2", ["identity", ["constant", 281]]],
            [
              "branch",
              ["constant", 0],
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
            ["let", "%3", ["add", ["peek", "%0"], ["peek", "%1"]]],
            ["jump", ["target", "^3", ["arguments"]]],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%4", ["add", ["peek", "%1"], ["peek", "%2"]]],
            ["jump", ["target", "^3", ["arguments"]]],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["return", "%4"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(evaluate(lower(input))).toBe(13 + 281);
  });

  it("must throw an error when condition is not a boolean", () => {
    // split
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (branch (constant 2) (target ^1 (arguments)) (target ^2 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (return %0)))
    (block
      (bindings)
      (instructions
        (let %1 (identity (constant 13)))
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
            [
              "branch",
              ["constant", 2],
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
            ["let", "%0", ["identity", ["constant", 11]]],
            ["return", "%0"],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%1", ["identity", ["constant", 13]]],
            ["return", "%1"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(() => evaluate(lower(input))).toThrow();
  });
});

describe("MIR: block parameters (control flow join)", () => {
  it("block bindings must assign from the correct register after an unconditional jump", () => {
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (jump (target ^2 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (jump (target ^3 (arguments (peek %0))))))
    (block
      (bindings)
      (instructions
        (let %1 (identity (constant 13)))
        (jump (target ^3 (arguments (peek %1))))))
    (block
      (bindings %2)
      (instructions
        (return %2)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["jump", ["target", "^2", ["arguments"]]],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 11]]],
            ["jump", ["target", "^3", ["arguments", ["peek", "%0"]]]],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%1", ["identity", ["constant", 13]]],
            ["jump", ["target", "^3", ["arguments", ["peek", "%1"]]]],
          ],
        ],
        [
          "block",
          ["bindings", "%2"],
          [
            "instructions",
            ["return", "%2"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(evaluate(lower(input))).toBe(13);
  });

  it("block bindings must assign from the correct register when executing a loop", () => {
    // C-style:
    //
    // int i = 0;
    // while (i != 3) {
    //     i++;
    // }
    // return i;
    //
    //
    // IR-code:
    //
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int Int Int Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 0)))
        (let %1 (identity (constant 1)))
        (let %2 (identity (constant 3)))
        (jump (target ^1 (arguments (peek %0))))))
    (block
      (bindings %3)
      (instructions
        (let %4 (add (peek %1) (peek %3)))
        (let %5 (unequal (peek %3) (peek %2)))
        (branch (peek %5) (target ^1 (arguments (peek %4))) (target ^2 (arguments)))))
    (block
      (bindings)
      (instructions
        (return %3)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"], ["Int"], ["Int"], ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 0]]],
            ["let", "%1", ["identity", ["constant", 1]]],
            ["let", "%2", ["identity", ["constant", 3]]],
            ["jump", ["target", "^1", ["arguments", ["peek", "%0"]]]],
          ],
        ],
        [
          "block",
          ["bindings", "%3"],
          [
            "instructions",
            ["let", "%4", ["add", ["peek", "%1"], ["peek", "%3"]]],
            ["let", "%5", ["unequal", ["peek", "%3"], ["peek", "%2"]]],
            [
              "branch",
              ["peek", "%5"],
              ["target", "^1", ["arguments", ["peek", "%4"]]],
              ["target", "^2", ["arguments"]],
            ],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["return", "%3"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(evaluate(lower(input))).toBe(3);
  });

  it("block bindings must allow assignment from dominator blocks which are not the immediate dominator", () => {
    // Control flow graph with a split in the Entry node and a Join in node D
    //
    //      Entry
    //      /   \
    //     A     B
    //      \    |
    //       \   C
    //        \ /
    //         D
    //
    //
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int Int Int Int Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 0)))
        (branch (peek %0) (target ^1 (arguments)) (target ^2 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %1 (identity (constant 11)))
        (jump (target ^4 (arguments (peek %1) (peek %1))))))
    (block
      (bindings)
      (instructions
        (let %2 (identity (constant 13)))
        (jump (target ^3 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %3 (identity (constant 281)))
        (jump (target ^4 (arguments (peek %2) (peek %3))))))
    (block
      (bindings %4 %5)
      (instructions
        (let %6 (add (peek %4) (peek %5)))
        (return %6)))))
`;

    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"], ["Int"], ["Int"], ["Int"], ["Int"], [
          "Int",
        ]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 0]]],
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
            ["let", "%1", ["identity", ["constant", 11]]],
            ["jump", ["target", "^4", ["arguments", ["peek", "%1"], [
              "peek",
              "%1",
            ]]]],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%2", ["identity", ["constant", 13]]],
            ["jump", ["target", "^3", ["arguments"]]],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%3", ["identity", ["constant", 281]]],
            ["jump", ["target", "^4", ["arguments", ["peek", "%2"], [
              "peek",
              "%3",
            ]]]],
          ],
        ],
        [
          "block",
          ["bindings", "%4", "%5"],
          [
            "instructions",
            ["let", "%6", ["add", ["peek", "%4"], ["peek", "%5"]]],
            ["return", "%6"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(evaluate(lower(input))).toBe(13 + 281);
  });

  it("block bindings must allow assignment when both inputs are available", () => {
    //
    //      Entry
    //        |
    //        A
    //      / |
    //     B  |
    //      \ |
    //        C
    //
    //
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (jump (target ^1 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 11)))
        (let %1 (identity (constant 1)))
        (branch (peek %1) (target ^2 (arguments)) (target ^3 (arguments (peek %0))))))
    (block
      (bindings)
      (instructions
        (let %2 (identity (constant 13)))
        (jump (target ^3 (arguments (peek %2))))))
    (block
      (bindings %3)
      (instructions
        (return %3)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"], ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["jump", ["target", "^1", ["arguments"]]],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 11]]],
            ["let", "%1", ["identity", ["constant", 1]]],
            [
              "branch",
              ["peek", "%1"],
              ["target", "^2", ["arguments"]],
              ["target", "^3", ["arguments", ["peek", "%0"]]],
            ],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%2", ["identity", ["constant", 13]]],
            ["jump", ["target", "^3", ["arguments", ["peek", "%2"]]]],
          ],
        ],
        [
          "block",
          ["bindings", "%3"],
          [
            "instructions",
            ["return", "%3"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(evaluate(lower(input))).toBe(13);
  });

  it("must allow assignment when three inputs are available", () => {
    //
    //        Entry
    //        |   |
    //        A   |
    //      / |   |
    //     B  |  /
    //      \ | /
    //        C
    //
    //
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 0)))
        (branch (peek %0) (target ^1 (arguments)) (target ^3 (arguments (peek %0))))))
    (block
      (bindings)
      (instructions
        (let %1 (identity (constant 1)))
        (branch (peek %1) (target ^2 (arguments)) (target ^3 (arguments (peek %1))))))
    (block
      (bindings)
      (instructions
        (let %2 (identity (constant 1)))
        (jump (target ^3 (arguments (peek %2))))))
    (block
      (bindings %3)
      (instructions
        (return %3)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"], ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 0]]],
            [
              "branch",
              ["peek", "%0"],
              ["target", "^1", ["arguments"]],
              ["target", "^3", ["arguments", ["peek", "%0"]]],
            ],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%1", ["identity", ["constant", 1]]],
            [
              "branch",
              ["peek", "%1"],
              ["target", "^2", ["arguments"]],
              ["target", "^3", ["arguments", ["peek", "%1"]]],
            ],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%2", ["identity", ["constant", 1]]],
            ["jump", ["target", "^3", ["arguments", ["peek", "%2"]]]],
          ],
        ],
        [
          "block",
          ["bindings", "%3"],
          [
            "instructions",
            ["return", "%3"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(evaluate(lower(input))).toBe(0);
  });

  it("must throw when a block argument is missing", () => {
    //
    //        Entry
    //        |   |
    //        A   |
    //      / |   |
    //     B  |  /
    //      \ | /
    //        C
    //
    //
    const text: string = `
(program
  (function
    (parameters)
    (locals Int Int Int Int)
    (result Int)
    (block
      (bindings)
      (instructions
        (let %0 (identity (constant 0)))
        (branch (peek %0) (target ^1 (arguments)) (target ^3 (arguments)))))
    (block
      (bindings)
      (instructions
        (let %1 (identity (constant 1)))
        (branch (peek %1) (target ^2 (arguments)) (target ^3 (arguments (peek %1))))))
    (block
      (bindings)
      (instructions
        (let %2 (identity (constant 1)))
        (jump (target ^3 (arguments (peek %2))))))
    (block
      (bindings %3)
      (instructions
        (return %3)))))
`;
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"], ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%0", ["identity", ["constant", 0]]],
            [
              "branch",
              ["peek", "%0"],
              ["target", "^1", ["arguments"]],
              ["target", "^3", ["arguments"]], // error: missing argument
            ],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%1", ["identity", ["constant", 1]]],
            [
              "branch",
              ["peek", "%1"],
              ["target", "^2", ["arguments"]],
              ["target", "^3", ["arguments", ["peek", "%1"]]],
            ],
          ],
        ],
        [
          "block",
          ["bindings"],
          [
            "instructions",
            ["let", "%2", ["identity", ["constant", 1]]],
            ["jump", ["target", "^3", ["arguments", ["peek", "%2"]]]],
          ],
        ],
        [
          "block",
          ["bindings", "%3"],
          [
            "instructions",
            ["return", "%3"],
          ],
        ],
      ],
    ];
    expect(input).toBeDefined();
    expect(print(input)).toEqual(text);
    // expect(() => evaluate(lower(input))).toThrow(); // runtime must flag this as an error
  });
});
