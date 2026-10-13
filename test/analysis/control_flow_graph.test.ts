import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import * as MIR from "../../src/new/new_grammar.ts";
import { Graph, make_cfg } from "../../src/analysis/control_flow_graph.ts";

describe("must compute control flow graphs for programs with one function", () => {
  it("which is empty", () => {
    const program: MIR.Program = ["program"];
    const expected: Graph = [];

    expect(make_cfg(program[1])).toEqual(expected);
  });

  it("with an empty instructions node", () => {
    const program: MIR.Program = ["program", [
      "function",
      ["parameters", ["Int"]],
      ["locals"],
      ["result", ["Int"]],
      ["block", ["bindings", "%0"], ["instructions"]],
    ]];

    const expected: Graph = [
      { pred: [], succ: [] },
    ];
    expect(make_cfg(program[1])).toEqual(expected);
  });

  it("must reject a non-terminating final instruction", () => {
    const program: MIR.Program = ["program", [
      "function",
      ["parameters"],
      ["locals", ["Int"]],
      ["result", ["Int"]],
      ["block", ["bindings"], [
        "instructions",
        ["let", "%0", ["identity", ["constant", 11]]],
      ]],
    ]];

    expect(() => make_cfg(program[1])).toThrow();
  });

  it("must preserve duplicate branch edges with different arguments", () => {
    const program: MIR.Program = ["program", [
      "function",
      ["parameters"],
      ["locals", ["Int"]],
      ["result", ["Int"]],
      ["block", ["bindings"], [
        "instructions",
        [
          "branch",
          ["constant", 1],
          ["target", "^1", ["arguments", ["constant", 11]]],
          ["target", "^1", ["arguments", ["constant", 13]]],
        ],
      ]],
      ["block", ["bindings", "%0"], ["instructions", ["return", "%0"]]],
    ]];

    const expected: Graph = [
      { pred: [], succ: ["^1", "^1"] },
      { pred: ["^0", "^0"], succ: [] },
    ];
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
        ["bindings"],
        [
          "instructions",
          ["let", "%0", ["identity", ["constant", 11]]],
          ["return", "%0"],
        ],
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
          ["return", "%0"],
        ],
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
        ["bindings"],
        [
          "instructions",
          ["let", "%0", ["identity", ["constant", 10]]],
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
          ["let", "%1", ["add", ["peek", "%0"], ["constant", 1]]],
          ["jump", ["target", "^3", ["arguments", ["peek", "%1"]]]],
        ],
      ],
      [
        "block",
        ["bindings"],
        [
          "instructions",
          ["let", "%2", ["add", ["peek", "%0"], ["constant", 2]]],
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
      ["locals", ["Int"], ["Int"], ["Int"], ["Int"]],
      ["result", ["Int"]],
      [
        "block",
        ["bindings"],
        [
          "instructions",
          ["let", "%0", ["identity", ["constant", 0]]],
          ["jump", ["target", "^1", ["arguments", ["peek", "%0"]]]],
        ],
      ],
      [
        "block",
        ["bindings", "%1"],
        [
          "instructions",
          ["let", "%2", ["add", ["peek", "%1"], ["constant", 1]]], // %2 = %1 + 1
          ["let", "%3", ["less", ["peek", "%2"], ["constant", 5]]], // %3 = %2 < 5
          [
            "branch",
            ["peek", "%3"],
            ["target", "^1", ["arguments", ["peek", "%2"]]],
            ["target", "^2", ["arguments"]],
          ],
        ],
      ],
      [
        "block",
        ["bindings"],
        [
          "instructions",
          ["return", "%1"],
        ],
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
