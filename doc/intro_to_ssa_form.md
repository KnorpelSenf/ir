# Introduction to Static Single-Assignment Form
by **Marco Nikander**

In
[static single-assignment (SSA) form](https://en.wikipedia.org/wiki/Static_single-assignment_form),
each variable is only assigned to _once_ in the source code of a program. Once
assigned, the value of a variable cannot be changed. This is useful for many
compiler optimizations, but also for analysis of programs. A prominent example
of SSA-form is 'LLVM IR' which is used to compile many programming languages
today. To convert a normal program into SSA form, variables are typically
versioned, so that a C program such as:

```c
int x  = 10;
    x  = 20;
    x  = x * 2;
```

becomes:

```
x0 = 10
x1 = 20
x2 = x1 * 2
```

If we look at this snippet in SSA form, we can spot that `x0` is never actually
used. The variable `x0` does not show up on the right-hand side anywhere in the
program. This means we can simplify the program to:

```
x1 = 20
x2 = x1 * 2
```

We've just done our first compiler optimization! If you are curious, this is one
kind of
[dead-code elimination](https://en.wikipedia.org/wiki/Dead-code_elimination).
Now back to SSA-form, and what it is.

SSA-form usually consists of:

1. variable assignments
2. expressions
3. control flow statements

An **assignment** defines a variable and binds it to a value: `x0 = ...`.

An **expression** is something which evaluates to a value. Basically, anything
which is on the right-hand side of an assignment. `10` is an expression, so is
`1 + 1`, so is an access to a variable such as in `x1 * 2` and a function call
such as `call f(42, true)`.

## Control Flow

**Control flow statements** allow us to perform conditional and looping
computations. It lets us build a flow-chart in our programs. It is needed for
programming constructs such as `if`, `for`, and `while`. Control flow also
allows us to `return` from a function. A control flow statement is always the
last line of a block.

In SSA form, control flow is usually expressed by grouping code into basic
blocks and using a conditional and an unconditional `jump` or `branch` statement
to jump from block to block. The first block is special, it is often called the
"entry" block, and we are not allowed to jump to it from other blocks. That
makes some optimizations and analyses easier.

Returning from a function is done using `return`. Let us look at a simple
example, which might be part of a function in C:

```c
bool condition = random_boolean();
if (condition) {
    return "heads";
} else {
    return "tails";
}
```

In this example, we call a function `random_boolean`, and depending on whether
it returns `true` or `false` we return "heads" or "tails", respectively. We
could translate it to SSA-form, using three _blocks_ of code, like this:

```
starting_block:
    condition = call random_boolean ()
    branch condition then_block else_block

then_block:
    return "heads"
    
else_block:
    return "tails"
```

Evaluation begins in the first block, the `starting_block`. We evaluate the
`random_boolean` function to get `true` or `false`, and assign that value to the
variable called `condition`. Then, depending on whether condition is true or
false, we _either_:

- go to the `then_block`
- go to the `else_block` and continue running our program there. `Return` has
  the same meaning as in C.

We can also use an `unconditional_branch` to just go to a block, without
checking any condition at all. For example, we could translate an infinite loop
such as:

```c
while(true) {
    print("hello");
}
```

into either:

```
loop:
    m = "hello"
    call print (m)
    c = true
    branch c loop loop     // this looks a bit silly
```

Or we could use an unconditional branch to just go to `loop`, no questions
asked:

```
loop:
    m = "hello"
    call print (m)
    unconditional_branch loop
```

## Control Flow Joins

Control flow, such as an if-statement or a loop, can be tricky to translate into
SSA form. This is especially true if the control flow has split into two or more
paths, using `branch`, and then rejoins again afterwards. For example, when we
have if-else blocks and have code which runs afterwards:

Take this example:

```c
bool c = random_boolean();
int x  =  0;
if (c) {
    x  = 10;
} else {
    x  = 20;
}
return x; // runs in both cases
```

How do we translate this? Let's stay in C for a moment, and try to assign
versions to our variables:

```c
bool c = random_boolean();
int x0 =  0;
if (c) {
    x1 = 10;
} else {
    x2 = 20;
}
return x_; // oh-ooh... should we return x1 or x2?
```

There are two possible ways of doing this:

1. phi nodes
2. block parameters

SSA-form was originally defined with **phi nodes**. Most of the literature on
SSA-form and most production compilers today, such as those using LLVM IR, use
phi nodes. A phi node binds a value to a variable, depending on which block we
_came from_. For example:

```
x3 = phi (then, x1) (else, x2)
```

Means:

- if we came from the `then` block: `x3 = x1`
- if we came from the `else` block: `x3 = x2`

**Block parameters** are a more recent invention. They are a lot like function
arguments, which makes them a bit easier to understand than phi nodes. Some
newer systems, such as MLIR, use block parameters. Formally, the two options are
_equivalent_. Here is the above C-snippet, translated to SSA-form with block
parameters:

```
start ():
    c = call random_boolean ()
    x0 = 0
    branch c then () else ()
    
then ():
    x1 = 10
    unconditional_branch final (x1)

else ():
    x2 = 20
    unconditional_branch final (x2)

final (x3):
    return x3
```

What's going on here? The big change is that _blocks can now take parameters_.
This is similar to a function call: we get to pass along a value. Unlike a
function call, we stay inside of the function we are currently in. In this
example, the `start`, `then`, and `else` blocks don't take any parameters. They
have an empty parameter list `()`. The `final` block does take one parameter,
which it binds to the variable `x3`.

So what happens?

- In the `start` block, depending on the random boolean, we go either to `then`
  or `else`
- In the `then` block, we branch to `final` with the value of `x1`.
- In the `else` block we branch to `final` with the value of `x2`.
- In the `final` block, we take whatever value we got, bind it to `x3` and then
  return `x3`

## Dominance

In the above example, it was quite easy to translate the C-code into several
blocks of code in SSA-form. It was also quite easy to figure out which
variable(s) we need to pass into which block(s). In large programs, this can be
more complicated.

There are special algorithms, which rely on a concept called
[dominance](https://en.wikipedia.org/wiki/Dominator_(graph_theory)) to compute
which variables must be passed where. Many of the relevant papers are as old as
SSA-form, and thus explain it in terms of phi nodes. Since phi nodes and block
parameters are equivalent, the same theory and same algorithms apply, even if
the notation of what is written where, is different.

## Utility of SSA-form

The nice thing about SSA-form is that it makes many compiler optimizations quite
easy to do, because each variable only ever has one value in the program. We
don't have to check if the value changed in between. Let us recall a code snippet
from above:

```c
bool c = random_boolean();
int x  =  0;
if (c) {
    x  = 10;
} else {
    x  = 20;
}
return x;
```

Which we translated to:

```
start ():
    c = call random_boolean ()
    x0 = 0
    branch c then () else ()
    
then ():
    x1 = 10
    unconditional_branch final (x1)

else ():
    x2 = 20
    unconditional_branch final (x2)

final (x3):
    return x3
```

If we wanted to optimize the code example above, there are a few things we can
do.

1. We might spot that `x0` is never actually used, so we can get rid of it.
2. Branching is slow, and in this case, we can actually get rid of some branches
   and blocks and still have the same functionality.

An equivalent simplified SSA program could look like this:

```
start ():
    c = call random_boolean ()
    x1 = 10
    x2 = 20
    branch c final (x1) final (x2)

final (x3):
    return x3
```

## Summary

Static single-assignment (SSA) form is commonly used in production compilers. It
gives a unique name to each value used in the program. This makes dataflow much
easier to analyze than when mutation is allowed. SSA is structured in functions
and basic blocks. Each basic block consists of assignments, expressions, and a
single control flow statement at the end of every block. The control flow
statements include unconditional / conditional `branch` and `return`. We can
call functions and assign their result to an SSA value like any other
assignment. Joins, where paths in the control flow meet again, may require a way
to select an incoming value. This can be done via `phi` nodes or via block
parameters. Those two representations are equivalent. There are well-established
algorithms which can be used to convert something like a C-program with
mutation, into a valid SSA-form program. Dominance, which was not explained
here, plays a key role in that conversion, since it determines where phi-nodes
or block parameters are necessary, such that the SSA code is valid.

---

**Copyright (c) 2026 Marco Nikander**
