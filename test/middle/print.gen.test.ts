import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import * as MIR from "../../src/middle/middle_grammar.ts";
import { print } from "../../src/middle/print.gen.ts";

describe("MIR printer", () => {
  it("prints empty and typed structural nodes", () => {
    const empty: MIR.Program = ["program"];
    expect(print(empty)).toBe("\n(program)\n");

    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters", ["Int"], ["Borrowed", ["Borrowed", ["Int"]]]],
        ["locals"],
        ["result", ["Borrowed", ["Int"]]],
      ],
    ];
    expect(print(input)).toBe(`
(program
  (function
    (parameters Int (Borrowed (Borrowed Int)))
    (locals)
    (result (Borrowed Int))))
`);

    const empty_blocks: MIR.Program = [
      "program",
      [
        "function",
        ["parameters"],
        ["locals", ["Int"], ["Int"]],
        ["result", ["Int"]],
        ["block", ["bindings"], ["instructions"]],
        ["block", ["bindings", "%0", "%1"], ["instructions"]],
      ],
    ];
    expect(print(empty_blocks)).toBe(`
(program
  (function
    (parameters)
    (locals Int Int)
    (result Int)
    (block
      (bindings)
      (instructions))
    (block
      (bindings %0 %1)
      (instructions))))
`);
  });

  it("prints bindings, calls, memory operations, and multiple functions", () => {
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters", ["Int"]],
        ["locals", ["Int"], ["Int"], ["Int"], ["Int"], ["Borrowed", ["Int"]], [
          "Borrowed",
          ["Borrowed", ["Int"]],
        ], ["Borrowed", ["Int"]]],
        ["result", ["Borrowed", ["Int"]]],
        [
          "block",
          ["bindings", "%0"],
          [
            "instructions",
            ["let", "%1", ["call", "@0", ["arguments", ["peek", "%0"], [
              "move",
              "%2",
            ]]]],
            ["let", "%2", ["call", "@1", ["arguments"]]],
            ["let", "%3", ["identity", ["constant", 42]]],
            ["let", "%4", ["identity", ["peek", "%3"]]],
            ["let", "%5", ["borrow", ["peek", "%4"]]],
            ["let", "%6", ["borrow", ["peek", "%5"]]],
            ["let", "%7", ["load", ["move", "%6"]]],
            ["drop", "%5"],
            ["return", "%7"],
          ],
        ],
        ["block", ["bindings"], ["instructions"]],
      ],
      [
        "function",
        ["parameters", ["Int"]],
        ["locals"],
        ["result", ["Int"]],
        ["block", ["bindings", "%0"], ["instructions", ["return", "%0"]]],
      ],
    ];
    expect(print(input)).toBe(`
(program
  (function
    (parameters Int)
    (locals Int Int Int Int (Borrowed Int) (Borrowed (Borrowed Int)) (Borrowed Int))
    (result (Borrowed Int))
    (block
      (bindings %0)
      (instructions
        (let %1 (call @0 (arguments (peek %0) (move %2))))
        (let %2 (call @1 (arguments)))
        (let %3 (identity (constant 42)))
        (let %4 (identity (peek %3)))
        (let %5 (borrow (peek %4)))
        (let %6 (borrow (peek %5)))
        (let %7 (load (move %6)))
        (drop %5)
        (return %7)))
    (block
      (bindings)
      (instructions)))
  (function
    (parameters Int)
    (locals)
    (result Int)
    (block
      (bindings %0)
      (instructions
        (return %0)))))
`);
  });

  it("prints every arithmetic, comparison, and control-flow instruction", () => {
    const binary_tags = [
      "add",
      "subtract",
      "multiply",
      "divide",
      "remainder",
      "minimum",
      "maximum",
      "equal",
      "unequal",
      "less",
      "less_equal",
      "greater",
      "greater_equal",
    ] as const;
    const lines: MIR.Line[] = binary_tags.map((tag, index) => [
      "let",
      MIR.resource_id(index),
      [tag, ["peek", "%0"], ["move", "%1"]],
    ]);
    lines.push(
      ["let", "%13", ["negate", ["peek", "%2"]]],
      ["branch", ["constant", 0], ["target", "^1", ["arguments"]], [
        "target",
        "^2",
        ["arguments"],
      ]],
      ["return", "%13"],
    );
    const input: MIR.Program = [
      "program",
      ["function", ["parameters"], ["locals"], ["result", ["Int"]], ["block", [
        "bindings",
      ], ["instructions", ...lines]]],
    ];
    const expected_lines = binary_tags.map((tag, index) =>
      `        (let %${index} (${tag} (peek %0) (move %1)))`
    );
    expect(print(input)).toBe(`
(program
  (function
    (parameters)
    (locals)
    (result Int)
    (block
      (bindings)
      (instructions
${expected_lines.join("\n")}
        (let %13 (negate (peek %2)))
        (branch (constant 0) (target ^1 (arguments)) (target ^2 (arguments)))
        (return %13)))))
`);
  });

  it("prints a jump with empty arguments", () => {
    const input: MIR.Program = [
      "program",
      ["function", ["parameters"], ["locals"], ["result", ["Int"]], ["block", [
        "bindings",
      ], ["instructions", ["jump", ["target", "^42", ["arguments"]]]]]],
    ];
    expect(print(input)).toBe(`
(program
  (function
    (parameters)
    (locals)
    (result Int)
    (block
      (bindings)
      (instructions
        (jump (target ^42 (arguments)))))))
`);
  });

  it("prints ordered bindings and independent target arguments", () => {
    const input: MIR.Program = [
      "program",
      [
        "function",
        ["parameters", ["Int"], ["Int"]],
        ["locals", ["Int"], ["Int"], ["Int"], ["Int"], ["Int"], ["Int"]],
        ["result", ["Int"]],
        [
          "block",
          ["bindings", "%0", "%1"],
          ["instructions", ["jump", ["target", "^1", [
            "arguments",
            ["peek", "%0"],
            ["move", "%1"],
            ["constant", 42],
          ]]]],
        ],
        [
          "block",
          ["bindings", "%2", "%3", "%4"],
          ["instructions", ["branch", ["peek", "%3"], ["target", "^2", [
            "arguments",
            ["move", "%4"],
            ["constant", 7],
          ]], ["target", "^3", ["arguments", ["peek", "%2"]]]]],
        ],
        ["block", ["bindings", "%5", "%6"], ["instructions", ["return", "%5"]]],
        ["block", ["bindings", "%7"], ["instructions", ["return", "%7"]]],
      ],
    ];
    expect(print(input)).toBe(`
(program
  (function
    (parameters Int Int)
    (locals Int Int Int Int Int Int)
    (result Int)
    (block
      (bindings %0 %1)
      (instructions
        (jump (target ^1 (arguments (peek %0) (move %1) (constant 42))))))
    (block
      (bindings %2 %3 %4)
      (instructions
        (branch (peek %3) (target ^2 (arguments (move %4) (constant 7))) (target ^3 (arguments (peek %2))))))
    (block
      (bindings %5 %6)
      (instructions
        (return %5)))
    (block
      (bindings %7)
      (instructions
        (return %7)))))
`);
  });
});
