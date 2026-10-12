import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import * as MIR from "../../src/middle/middle_grammar.ts";
import { Graph, make_cfg } from "../../src/analysis/control_flow_graph.ts";

describe("must compute control flow graphs for programs with one function", () => {
  it("which is empty", () => {
    const program: MIR.Program = ["program"];
    const expected: Graph = [];

    expect(make_cfg(program[1])).toEqual(expected);
  });

  it("with one block", () => {
    const program: MIR.Program = ["program", [
      "function",
      ["parameters"],
      ["locals", ["Int"]],
      ["result", ["Int"]],
      [
        "block",
        ["let", "%0", ["identity", ["constant", 11]]],
        ["return", "%0"],
      ],
    ]];

    const expected: Graph = [{ pred: [], succ: [] }];

    expect(make_cfg(program[1])).toEqual(expected);
  });

  it("with two sequential blocks", () => {
    const program: MIR.Program = ["program", [
      "function",
      ["parameters"],
      ["locals", ["Int"]],
      ["result", ["Int"]],
      [
        "block",
        ["jump", "^1"],
      ],
      [
        "block",
        ["let", "%0", ["identity", ["constant", 11]]],
        ["return", "%0"],
      ],
    ]];
    const expected: Graph = [
      { pred: [], succ: ["^1"] },
      { pred: ["^0"], succ: [] },
    ];

    expect(make_cfg(program[1])).toEqual(expected);
  });

  it("with four blocks which form a diamond", () => {
    const program: MIR.Program = ["program", [
      "function",
      ["parameters"],
      ["locals", ["Int"], ["Int"], ["Int"], ["Int"], ["Int"]],
      ["result", ["Int"]],
      [
        "block",
        ["let", "%0", ["identity", ["constant", 10]]],
        ["branch", ["constant", 0], "^1", "^2"],
      ],
      [
        "block",
        ["let", "%1", ["add", ["peek", "%0"], ["constant", 1]]],
        ["jump", "^3"],
      ],
      [
        "block",
        ["let", "%2", ["add", ["peek", "%0"], ["constant", 2]]],
        ["jump", "^3"],
      ],
      [
        "block",
        ["let", "%3", ["phi", [
          "sources",
          ["from", "^1", ["peek", "%1"]],
          ["from", "^2", ["peek", "%2"]],
        ]]],
        ["return", "%3"],
      ],
    ]];

    const expected: Graph = [
      { pred: [], succ: ["^1", "^2"] },
      { pred: ["^0"], succ: ["^3"] },
      { pred: ["^0"], succ: ["^3"] },
      { pred: ["^1", "^2"], succ: [] },
    ];

    expect(make_cfg(program[1])).toEqual(expected);
  });

  it("with three blocks which split into two separate return blocks", () => {
    const program: MIR.Program = ["program", [
      "function",
      ["parameters"],
      ["locals", ["Int"], ["Int"]],
      ["result", ["Int"]],
      [
        "block",
        ["branch", ["constant", 0], "^1", "^2"],
      ],
      [
        "block",
        ["let", "%0", ["identity", ["constant", 11]]],
        ["return", "%0"],
      ],
      [
        "block",
        ["let", "%1", ["identity", ["constant", 13]]],
        ["return", "%1"],
      ],
    ]];
    const expected: Graph = [
      { pred: [], succ: ["^1", "^2"] },
      { pred: ["^0"], succ: [] },
      { pred: ["^0"], succ: [] },
    ];

    expect(make_cfg(program[1])).toEqual(expected);
  });

  it("with an entry block, loop block, and final block", () => {
    const program: MIR.Program = ["program", [
      "function",
      ["parameters"],
      ["locals", ["Int"], ["Int"], ["Int"]],
      ["result", ["Int"]],
      [
        "block",
        ["let", "%0", ["identity", ["constant", 0]]],
        ["jump", "^1"],
      ],
      [
        "block",
        ["let", "%1", ["phi", [
          "sources",
          ["from", "^0", ["peek", "%0"]],
          ["from", "^1", ["peek", "%2"]],
        ]]],
        ["let", "%2", ["add", ["peek", "%1"], ["constant", 1]]], // %2 = %1 + 1
        ["let", "%3", ["less", ["peek", "%2"], ["constant", 5]]], // %3 = %2 < 5
        ["branch", ["peek", "%3"], "^1", "^2"],
      ],
      [
        "block",
        ["return", "%1"],
      ],
    ]];

    const expected: Graph = [
      { pred: [], succ: ["^1"] },
      { pred: ["^0", "^1"], succ: ["^1", "^2"] },
      { pred: ["^1"], succ: [] },
    ];

    expect(make_cfg(program[1])).toEqual(expected);
  });
});
