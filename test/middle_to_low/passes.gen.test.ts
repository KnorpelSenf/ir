// Copyright (c) 2026 Marco Nikander

import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import * as MIR from "../../src/middle/middle_grammar.ts";
import { evaluate } from "../../src/low/machine.ts";
import { lower } from "../../src/middle_to_low/lower.gen.ts";
import {
  lower_operations,
  resolve_targets,
  validate_and_index,
} from "../../src/middle_to_low/mod.gen.ts";

function block(bindings: MIR.ResourceId[], ...lines: MIR.Line[]): MIR.Block {
  return ["block", ["bindings", ...bindings], ["instructions", ...lines]];
}

function target(id: MIR.BlockId, ...operands: MIR.Operand[]): MIR.Target {
  return ["target", id, ["arguments", ...operands]];
}

function func(blocks: MIR.Block[], locals = 1, parameters = 0): MIR.Function {
  const integers = (count: number): MIR.Type[] =>
    Array.from({ length: count }, () => ["Int"]);
  return [
    "function",
    ["parameters", ...integers(parameters)],
    ["locals", ...integers(locals)],
    ["result", ["Int"]],
    ...blocks,
  ];
}

function program(lines: MIR.Line[], locals = 1): MIR.Program {
  return ["program", func([block([], ...lines)], locals)];
}

function with_blocks(blocks: MIR.Block[], locals = 1): MIR.Program {
  return ["program", func(blocks, locals)];
}

describe("MIR to LIR micro-passes", () => {
  it("indexes resources and rejects duplicate let definitions", () => {
    const indexed = validate_and_index(
      program([["let", "%0", ["identity", ["constant", 1]]], ["return", "%0"]]),
    );
    expect(indexed[0].resource_count).toBe(1);
    expect(indexed[0].blocks[0].bindings).toEqual([]);
    expect(() =>
      validate_and_index(
        program([
          ["let", "%0", ["identity", ["constant", 1]]],
          ["let", "%0", ["identity", ["constant", 2]]],
          ["return", "%0"],
        ]),
      )
    ).toThrow("defined more than once");
  });

  it("rejects duplicate bindings and binding/let collisions", () => {
    const invalid_blocks = [
      block(["%0", "%0"], ["return", "%0"]),
      block(["%0"], ["let", "%0", ["identity", ["constant", 2]]], [
        "return",
        "%0",
      ]),
    ];
    for (const invalid of invalid_blocks) {
      expect(() =>
        validate_and_index(with_blocks([
          block([], ["return", "%0"]),
          invalid,
        ]))
      ).toThrow("defined more than once");
    }
    expect(() =>
      validate_and_index(with_blocks([
        block([], ["return", "%0"]),
        block(["%0"], ["return", "%0"]),
        block(["%0"], ["return", "%0"]),
      ]))
    ).toThrow("defined more than once");
  });

  it("validates resources, block targets, and function references", () => {
    const invalid_programs: MIR.Program[] = [
      program([["let", "%1", ["identity", ["constant", 0]]], ["return", "%0"]]),
      program([["let", "%0", ["identity", ["peek", "%1"]]], ["return", "%0"]]),
      program([["drop", "%1"], ["return", "%0"]]),
      program([["return", "%1"]]),
      program([["jump", target("^1")]]),
      program([["branch", ["constant", 1], target("^0"), target("^1")]]),
      program([["let", "%0", ["call", "@1", ["arguments"]]], ["return", "%0"]]),
      with_blocks([
        block([], ["return", "%0"]),
        block(["%1"], ["return", "%0"]),
      ]),
      with_blocks([
        block([], ["jump", target("^1", ["peek", "%1"])]),
        block(["%0"], ["return", "%0"]),
      ]),
    ];
    for (const input of invalid_programs) {
      expect(() => validate_and_index(input)).toThrow("Invalid");
    }
  });

  it("requires canonical entry bindings and validates call arity", () => {
    const callee = func([block(["%0", "%1"], ["return", "%0"])], 1, 2);
    for (
      const bindings of [[], ["%0"], ["%1", "%0"], [
        "%0",
        "%2",
      ]] as MIR.ResourceId[][]
    ) {
      const invalid: MIR.Function = [...callee];
      invalid[4] = block(bindings, ["return", "%0"]);
      expect(() => validate_and_index(["program", invalid])).toThrow(
        "canonical",
      );
    }
    expect(() => validate_and_index(["program", callee])).not.toThrow();
    for (const count of [1, 3]) {
      const args: MIR.Operand[] = Array.from(
        { length: count },
        () => ["constant", 1],
      );
      const caller = func([
        block([], ["let", "%0", ["call", "@1", ["arguments", ...args]]], [
          "return",
          "%0",
        ]),
      ]);
      expect(() => validate_and_index(["program", caller, callee])).toThrow(
        "Argument count",
      );
    }
  });

  it("rejects missing and excess arguments on every edge", () => {
    for (
      const args of [[], [["constant", 1], ["constant", 2]]] as MIR.Operand[][]
    ) {
      for (
        const terminator of [
          ["jump", target("^1", ...args)],
          [
            "branch",
            ["constant", 1],
            target("^1", ["constant", 1]),
            target("^1", ...args),
          ],
        ] as MIR.Terminator[]
      ) {
        expect(() =>
          validate_and_index(with_blocks([
            block([], terminator),
            block(["%0"], ["return", "%0"]),
          ]))
        ).toThrow("Argument count");
      }
    }
  });

  it("materializes literals above declared resources", () => {
    const output = lower_operations(validate_and_index(program([
      ["let", "%0", ["add", ["constant", 2], ["constant", 3]]],
      ["return", "%0"],
    ])));
    expect(output).toContainEqual([1, "constant", { value: 2 }]);
    expect(output).toContainEqual([2, "constant", { value: 3 }]);
    expect(output).toContainEqual([0, "add", 1, 2]);
  });

  it("drops consumed operands but preserves accessed operands", () => {
    const output = lower_operations(validate_and_index(program([
      ["let", "%0", ["identity", ["constant", 7]]],
      ["let", "%1", ["add", ["move", "%0"], ["constant", 1]]],
      ["return", "%1"],
    ], 2)));
    expect(output).toContainEqual([0, "drop"]);
    expect(output).not.toContainEqual([1, "drop"]);
  });

  it("lowers jump bindings inline with constants and repeated sources", () => {
    const input = with_blocks([
      block([], ["let", "%0", ["identity", ["constant", 7]]], [
        "jump",
        target("^1", ["peek", "%0"], ["peek", "%0"], ["constant", 3]),
      ]),
      block(
        ["%1", "%2", "%3"],
        ["let", "%4", ["add", ["peek", "%1"], ["peek", "%2"]]],
        ["let", "%5", ["add", ["peek", "%4"], ["peek", "%3"]]],
        ["return", "%5"],
      ),
    ], 6);
    const output = lower_operations(validate_and_index(input));
    expect(
      output.filter((op) => op[1] === "noop" && op[2]?.startsWith("block "))
        .length,
    ).toBe(2);
    expect(evaluate(resolve_targets(output))).toBe(17);
  });

  it("keeps empty-argument branches direct", () => {
    const input = with_blocks([
      block([], ["branch", ["constant", 1], target("^1"), target("^2")]),
      block([], ["let", "%0", ["identity", ["constant", 11]]], [
        "return",
        "%0",
      ]),
      block([], ["let", "%1", ["identity", ["constant", 13]]], [
        "return",
        "%1",
      ]),
    ], 2);
    const output = lower_operations(validate_and_index(input));
    expect(
      output.filter((op) => op[1] === "noop" && op[2]?.startsWith("block "))
        .length,
    ).toBe(3);
    expect(evaluate(resolve_targets(output))).toBe(11);
  });

  it("keeps different arguments on branch arms targeting the same block", () => {
    for (const condition of [0, 1]) {
      const input = with_blocks([
        block([], [
          "branch",
          ["constant", condition],
          target("^1", ["constant", 11]),
          target("^1", ["constant", 13]),
        ]),
        block(["%0"], ["return", "%0"]),
      ]);
      const output = lower_operations(validate_and_index(input));
      const branch = output.find((op) => op[1] === "branch");
      expect(branch?.[1]).toBe("branch");
      if (branch?.[1] === "branch") {
        expect(branch[3][0].block_id).not.toBe(branch[3][1].block_id);
      }
      expect(evaluate(resolve_targets(output))).toBe(condition ? 11 : 13);
    }
  });

  it("does not read unavailable arguments on an untaken arm", () => {
    for (const condition of [0, 1]) {
      const available = target("^1", ["constant", 42]);
      const unavailable = target("^1", ["peek", "%0"]);
      const input = with_blocks([
        block(
          [],
          ["let", "%0", ["identity", ["constant", 7]]],
          ["drop", "%0"],
          [
            "branch",
            ["constant", condition],
            condition ? available : unavailable,
            condition ? unavailable : available,
          ],
        ),
        block(["%1"], ["return", "%1"]),
      ], 2);
      expect(evaluate(lower(input))).toBe(42);
    }
  });

  it("selects the branch before a transfer overwrites its condition", () => {
    for (const initial of [0, 1]) {
      const input = with_blocks([
        block([], ["jump", target("^1", ["constant", initial])]),
        block(["%0"], [
          "branch",
          ["peek", "%0"],
          target("^1", ["constant", 0]),
          target("^2"),
        ]),
        block([], ["return", "%0"]),
      ]);
      expect(evaluate(lower(input))).toBe(0);
    }
  });

  it("preserves a consumed branch condition until the branch executes", () => {
    const input = with_blocks([
      block([], ["let", "%0", ["identity", ["constant", 1]]], [
        "branch",
        ["move", "%0"],
        target("^1", ["constant", 11]),
        target("^1", ["constant", 13]),
      ]),
      block(["%1"], ["return", "%1"]),
    ], 2);
    expect(evaluate(lower(input))).toBe(11);
  });

  for (const width of [2, 3]) {
    it(`snapshots a ${width}-value cycle across repeated loop edges`, () => {
      const resources = Array.from(
        { length: width },
        (_, index) => MIR.resource_id(index),
      );
      const counter = MIR.resource_id(width);
      const next_counter = MIR.resource_id(width + 1);
      const condition = MIR.resource_id(width + 2);
      const result = MIR.resource_id(width + 3);
      const input = with_blocks([
        block([], [
          "jump",
          target(
            "^1",
            ...resources.map((
              _,
              index,
            ): MIR.Operand => ["constant", index + 1]),
            ["constant", 0],
          ),
        ]),
        block([...resources, counter], ["let", next_counter, ["add", [
          "peek",
          counter,
        ], ["constant", 1]]], ["let", condition, ["less", ["peek", counter], [
          "constant",
          5,
        ]]], [
          "branch",
          ["peek", condition],
          target(
            "^1",
            ...resources.map((
              _,
              index,
            ): MIR.Operand => ["peek", resources[(index + 1) % width]]),
            ["peek", next_counter],
          ),
          target("^2"),
        ]),
        block([], ["let", result, ["subtract", ["peek", resources[0]], [
          "peek",
          resources[width - 1],
        ]]], ["return", result]),
      ], width + 4);
      expect(evaluate(lower(input))).toBe(1);
    });
  }

  it("resolves generated edge labels within the correct function", () => {
    const branching = (value: number): MIR.Function =>
      func([
        block([], [
          "branch",
          ["constant", 1],
          target("^1", ["constant", value]),
          target("^1", ["constant", 0]),
        ]),
        block(["%0"], ["return", "%0"]),
      ]);
    const input: MIR.Program = [
      "program",
      func([
        block(
          [],
          ["let", "%0", ["call", "@1", ["arguments"]]],
          ["let", "%1", ["call", "@2", ["arguments"]]],
          ["let", "%2", ["add", ["peek", "%0"], ["peek", "%1"]]],
          ["return", "%2"],
        ),
      ], 3),
      branching(11),
      branching(13),
    ];
    expect(evaluate(lower(input))).toBe(24);
  });
});
