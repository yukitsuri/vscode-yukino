export interface FunctionDoc {
  name: string;
  signature: string;
  summary: string;
  description: string;
  parameters: { name: string; type: string; description: string }[];
  returnType: string;
  example?: string;
  module?: string;
}

export interface KeywordDoc {
  name: string;
  category: "declaration" | "control" | "memory" | "module" | "modifier" | "literal";
  summary: string;
  description: string;
  example: string;
}

export const YUKINO_KEYWORDS: Record<string, KeywordDoc> = {
  true: {
    name: "true",
    category: "literal",
    summary: "Boolean literal (true).",
    description: "Boolean `true` value of type `bool`.",
    example: "set flag: bool = true"
  },
  false: {
    name: "false",
    category: "literal",
    summary: "Boolean literal (false).",
    description: "Boolean `false` value of type `bool`.",
    example: "set flag: bool = false"
  },
  null: {
    name: "null",
    category: "literal",
    summary: "Null literal.",
    description: "The null value for nullable types and raw pointers.",
    example: "set p: ptr<int32>? = null"
  },
  set: {
    name: "set",
    category: "declaration",
    summary: "Declares a local variable with type inference or explicit type.",
    description: "Variables declared with `set` can be immutable or mutable via `rewrite`. Type can be inferred or specified after a colon.",
    example: "set count = 0\nset buffer_size: int64 = 4096"
  },
  rewrite: {
    name: "rewrite",
    category: "declaration",
    summary: "Mandatory keyword for mutating variable, field, or array element state.",
    description: "In Yukino, plain assignments (`x = 10`) are forbidden and trigger compile error E0201. All mutations must explicitly use `rewrite`.",
    example: "rewrite balance = 200\nrewrite numbers[0] = 10\nrewrite user.score += 1"
  },
  static: {
    name: "static",
    category: "declaration",
    summary: "Declares a compile-time constant or static member.",
    description: "Static variables are evaluated at compile time and cannot be mutated by `rewrite`.",
    example: "static MAX_CONNECTIONS: int32 = 1000"
  },
  fun: {
    name: "fun",
    category: "declaration",
    summary: "Declares a function or method.",
    description: "Declares a first-class function. Return type is specified via `->`. Defaults to `void` if omitted.",
    example: "fun calc(a: int32, b: int32) -> int32 {\n    return a + b\n}"
  },
  cfun: {
    name: "cfun",
    category: "declaration",
    summary: "Declares a C ABI compatible function.",
    description: "Declares or imports an external C ABI function, usually paired with attributes like `|cdecl|`.",
    example: "|cdecl| public cfun puts(msg: ptr<char>) -> int32"
  },
  struct: {
    name: "struct",
    category: "declaration",
    summary: "Declares a lightweight value-type data structure.",
    description: "Structs in Yukino have direct C-compatible memory layout, living on stack or embedded without vtable overhead.",
    example: "struct Point {\n    x: float64,\n    y: float64\n}"
  },
  cstruct: {
    name: "cstruct",
    category: "declaration",
    summary: "Declares a strictly C-compatible struct layout.",
    description: "Guarantees exact C ABI struct alignment and padding for FFI.",
    example: "cstruct NativeHeader {\n    magic: uint32,\n    length: uint32\n}"
  },
  class: {
    name: "class",
    category: "declaration",
    summary: "Declares a polymorphic reference type with inheritance and vtable.",
    description: "Classes support single inheritance (`extends`), constructors (`fun init`), getters/setters and virtual methods.",
    example: "class Animal {\n    name: string\n    fun init(name: string) { rewrite this.name = name }\n}"
  },
  locked: {
    name: "locked",
    category: "modifier",
    summary: "Prohibits inheritance from a class.",
    description: "Similar to `final` or `sealed` in other languages. Inheriting from a locked class produces compiler error E0409.",
    example: "locked class GuardService {\n    active: bool\n}"
  },
  interface: {
    name: "interface",
    category: "declaration",
    summary: "Declares an interface contract dispatched via itable.",
    description: "Classes implement interfaces using `with InterfaceName`.",
    example: "interface Describable {\n    fun describe() -> string\n}"
  },
  enum: {
    name: "enum",
    category: "declaration",
    summary: "Declares an enumeration or algebraic data type (ADT).",
    description: "Enums support simple labels, integer values, and payload variants (ADT).",
    example: "enum TaskStatus {\n    Queued,\n    Running,\n    Finished(code: int32)\n}"
  },
  type: {
    name: "type",
    category: "declaration",
    summary: "Defines a type definition or custom type.",
    description: "Used to declare distinct types or type wrappers.",
    example: "type UserId = uint64"
  },
  alias: {
    name: "alias",
    category: "declaration",
    summary: "Declares a type alias.",
    description: "Creates an alias for an existing type without creating a new nominal type.",
    example: "alias NumberList = int32[]"
  },
  public: {
    name: "public",
    category: "modifier",
    summary: "Exports a symbol outside the current module.",
    description: "By default, symbols in Yukino are private to their module. `public` makes them exportable.",
    example: "public fun add(a: int32, b: int32) -> int32 { return a + b }"
  },
  operator: {
    name: "operator",
    category: "declaration",
    summary: "Overloads an operator for a class.",
    description: "Allows classes to define custom behaviors for binary operators like `+`, `==`, etc.",
    example: "operator +(other: Complex) -> Complex {\n    return Complex(this.re + other.re, this.im + other.im)\n}"
  },
  define: {
    name: "define",
    category: "declaration",
    summary: "Declares a compile-time hygienic macro.",
    description: "Declares an expression macro (`define name(args) => expr`) or block macro (`define name(args) { ... }`). Invoked using `name!(...)`.",
    example: "define square(x) => x * x\ndefine init_pt(x, y) {\n    set x = 0\n    set y = 0\n}"
  },
  get: {
    name: "get",
    category: "declaration",
    summary: "Declares a computed getter property.",
    description: "Defines a read property on a class accessed like a field.",
    example: "get area() -> float64 {\n    return this.w * this.h\n}"
  },
  space: {
    name: "space",
    category: "control",
    summary: "Explicit no-op statement placeholder.",
    description: "Used in empty function bodies, interface stubs, or ignore branches to silence empty-body warnings.",
    example: "fun on_tick() {\n    space\n}"
  },
  sus: {
    name: "sus",
    category: "control",
    summary: "Begins a structured exception-handling block.",
    description: "Pairs with `catch` and optional `finally` to handle runtime panics or thrown typed error payloads.",
    example: "sus {\n    risky_operation()\n} catch e: MathError {\n    println(\"Math error: ${e.message}\")\n}"
  },
  catch: {
    name: "catch",
    category: "control",
    summary: "Catches errors from a preceding `sus` block.",
    description: "Can catch specific error struct types or catch-all.",
    example: "catch e: IOError {\n    print(e.message)\n}"
  },
  finally: {
    name: "finally",
    category: "control",
    summary: "Block executed regardless of whether an exception occurred.",
    description: "Guarantees resource cleanup at the end of a `sus` block.",
    example: "finally {\n    cleanup()\n}"
  },
  switch: {
    name: "switch",
    category: "control",
    summary: "Pattern matching control expression.",
    description: "Evaluates matching arms using `->` and `else ->` for default.",
    example: "switch op {\n    '+' -> a + b,\n    '-' -> a - b,\n    else -> 0\n}"
  },
  init: {
    name: "init",
    category: "declaration",
    summary: "Instantiates a new class or struct instance.",
    description: "Instantiates a class or struct (`set obj = init MyClass(...)`), invoking its constructor method (`fun init`).",
    example: "set x = init Class()\nset player = init Player(\"Alice\", 100)"
  },
  load: {
    name: "load",
    category: "module",
    summary: "Imports modules or symbols.",
    description: "Loads symbols by package, root or relative path: `load root.mod: symbol`, `load std.io: print`. A `!` after a path segment forces folder resolution; the symbols clause accepts `*`, `prefix*` and `*suffix` patterns plus a single shared `as` alias list.",
    example: "load std.io: print, println\nload .helper: calc as my_calc\nload .subpkg!: helper_fn"
  },
  this: {
    name: "this",
    category: "memory",
    summary: "Reference to the current class instance.",
    description: "Points to the receiver instance inside class methods and constructors.",
    example: "rewrite this.x = x"
  },
  super: {
    name: "super",
    category: "memory",
    summary: "Calls the base class constructor or base method.",
    description: "Invokes parent constructor inside `init` or accesses overridden parent methods.",
    example: "super(name)"
  },
  ref: {
    name: "ref",
    category: "memory",
    summary: "Takes an immutable reference (`ref`) or mutable reference (`ref ~`).",
    description: "Passes heavy value-types without copying and without transferring ownership.",
    example: "inspect(ref my_struct)\nmutate(ref ~my_struct)"
  },
  with: {
    name: "with",
    category: "declaration",
    summary: "Declares that a class implements one or more interfaces.",
    description: "Binds the class to the interface itable contract.",
    example: "class Item with Describable"
  },
  extends: {
    name: "extends",
    category: "declaration",
    summary: "Specifies single inheritance for a class.",
    description: "Derives a child class from a base class.",
    example: "class Dog extends Animal"
  },
  is: {
    name: "is",
    category: "control",
    summary: "Type check operator for union types.",
    description: "Checks whether a value currently matches a specific type variant.",
    example: "if value is int32 { space }"
  },
  defer: {
    name: "defer",
    category: "control",
    summary: "Defers execution of a statement until the enclosing scope exits.",
    description: "Guarantees execution when leaving the function or block.",
    example: "defer file.close()"
  },
  recur: {
    name: "recur",
    category: "control",
    summary: "Explicit tail-call recursion jump.",
    description: "Re-executes the current function with new arguments without growing the call stack.",
    example: "recur(n - 1, acc * n)"
  },
  region: {
    name: "region",
    category: "memory",
    summary: "Explicit regional memory allocation scope.",
    description: "Allocates objects within a bounded region that is freed all at once.",
    example: "region {\n    set temp = ComplexObject()\n}"
  },
  if: {
    name: "if",
    category: "control",
    summary: "Conditional branch.",
    description: "Executes the block when the condition is true. Chains with `elif` and `else`.",
    example: "if x > 0 {\n    print(\"positive\")\n}"
  },
  elif: {
    name: "elif",
    category: "control",
    summary: "Alternative condition of an `if` chain.",
    description: "Checked only when the preceding `if`/`elif` conditions were false.",
    example: "if x > 0 {\n    space\n} elif x < 0 {\n    space\n}"
  },
  else: {
    name: "else",
    category: "control",
    summary: "Fallback branch of an `if` chain.",
    description: "Executes when all preceding conditions are false.",
    example: "if x > 0 {\n    space\n} else {\n    space\n}"
  },
  while: {
    name: "while",
    category: "control",
    summary: "Loop that repeats while a condition holds.",
    description: "Re-evaluates the condition before each iteration.",
    example: "while i < 10 {\n    rewrite i += 1\n}"
  },
  for: {
    name: "for",
    category: "control",
    summary: "Iteration loop over a range, slice, or iterable.",
    description: "Iterates `variable` over `iterable` (ranges like `0..n`, slices, etc.). Supports an optional label for `break label`/`continue label`.",
    example: "for i in 0..10 {\n    print(\"${i}\")\n}"
  },
  in: {
    name: "in",
    category: "control",
    summary: "Separator between the loop variable and the iterable in `for`.",
    description: "Part of the `for x in iterable` syntax.",
    example: "for item in items {\n    space\n}"
  },
  loop: {
    name: "loop",
    category: "control",
    summary: "Infinite loop.",
    description: "Repeats the body forever until a `break` is executed.",
    example: "loop {\n    break\n}"
  },
  break: {
    name: "break",
    category: "control",
    summary: "Exits the nearest loop or a labeled one.",
    description: "Interrupts the innermost loop, or the loop marked with the matching label.",
    example: "loop {\n    break\n}"
  },
  continue: {
    name: "continue",
    category: "control",
    summary: "Skips to the next iteration of the loop.",
    description: "Jumps to the next iteration of the innermost loop, or of a labeled one.",
    example: "for i in 0..10 {\n    continue\n}"
  },
  return: {
    name: "return",
    category: "control",
    summary: "Returns from the enclosing function.",
    description: "Optionally followed by an expression matching the function's return type.",
    example: "fun add(a: int32, b: int32) -> int32 {\n    return a + b\n}"
  },
  externc: {
    name: "externc",
    category: "module",
    summary: "Declares a block of external C declarations.",
    description: "Groups `cfun` and `cstruct` declarations imported from C, optionally with a header name string.",
    example: "externc \"stdio.h\" {\n    cfun puts(message: ptr<c_char>) -> c_int\n}"
  }
};

export const YUKINO_INTRINSICS: Record<string, FunctionDoc> = {
  typeof: {
    name: "typeof",
    signature: "typeof(expr: T) -> string",
    summary: "Compile-time type introspection.",
    description: "Evaluates the static type of `expr` at compile time and returns its canonical name as string without runtime overhead.",
    parameters: [{ name: "expr", type: "T", description: "Any valid Yukino expression" }],
    returnType: "string",
    example: "set t = typeof(42) // \"int32\""
  },
  cast: {
    name: "cast",
    signature: "cast(value: T, target: \"target_type\" | typeof(expr)) -> U",
    summary: "Explicit type cast intrinsic.",
    description: "Converts between numeric types, characters, strings, pointers, and bytes. Target must be a string literal or `typeof()`.",
    parameters: [
      { name: "value", type: "T", description: "Source value to convert" },
      { name: "target", type: "string | typeof", description: "Target type literal e.g. \"int32\" or typeof(x)" }
    ],
    returnType: "U",
    example: "set num = cast(\"123\", \"int32\")\nset b = cast(1024, \"uint8\")"
  },
  args: {
    name: "args",
    signature: "args() -> []string",
    summary: "Returns command line arguments.",
    description: "Returns user-supplied CLI arguments as a slice of strings (program name is omitted).",
    parameters: [],
    returnType: "[]string",
    example: "set input = args()\nif input.len() < 2 { exit(1) }"
  },
  raw_args: {
    name: "raw_args",
    signature: "raw_args() -> string",
    summary: "Returns raw system command line string.",
    description: "Returns the platform command line string for low-level C FFI interoperability.",
    parameters: [],
    returnType: "string",
    example: "set cmd = raw_args()"
  },
  exit: {
    name: "exit",
    signature: "exit(code: int32) -> never",
    summary: "Terminates the process immediately.",
    description: "Exits the program with the specified integer exit status code.",
    parameters: [{ name: "code", type: "int32", description: "Process exit code (0 for success)" }],
    returnType: "never",
    example: "exit(0)"
  },
  panic: {
    name: "panic",
    signature: "panic(message: string | payload: S) -> never",
    summary: "Aborts execution with an error.",
    description: "Stops execution and starts exception unwinding, passing an error message or error payload struct.",
    parameters: [{ name: "payload", type: "string | Struct", description: "Error message or error object" }],
    returnType: "never",
    example: "panic(\"Index out of bounds\")"
  },
  assert: {
    name: "assert",
    signature: "assert(condition: bool)",
    summary: "Asserts that a condition is true.",
    description: "Panics if `condition` is false.",
    parameters: [{ name: "condition", type: "bool", description: "Condition that must hold true" }],
    returnType: "void",
    example: "assert(x > 0)"
  },
  assert_eq: {
    name: "assert_eq",
    signature: "assert_eq(a: T, b: T)",
    summary: "Asserts that two values are equal.",
    description: "Panics with a descriptive error message if `a != b`.",
    parameters: [
      { name: "a", type: "T", description: "First value" },
      { name: "b", type: "T", description: "Second value" }
    ],
    returnType: "void",
    example: "assert_eq(calc(2, '+', 2), 4)"
  },
  assert_ne: {
    name: "assert_ne",
    signature: "assert_ne(a: T, b: T)",
    summary: "Asserts that two values are not equal.",
    description: "Panics if `a == b`.",
    parameters: [
      { name: "a", type: "T", description: "First value" },
      { name: "b", type: "T", description: "Second value" }
    ],
    returnType: "void",
    example: "assert_ne(ptr, null)"
  },
  ptr_of: {
    name: "ptr_of",
    signature: "ptr_of(val: T) -> ptr<T>",
    summary: "Returns raw memory pointer to a variable.",
    description: "Low-level intrinsic returning a raw pointer `ptr<T>` for C ABI interaction.",
    parameters: [{ name: "val", type: "T", description: "Variable to inspect" }],
    returnType: "ptr<T>",
    example: "set p = ptr_of(my_var)"
  },
  from_raw_parts: {
    name: "from_raw_parts",
    signature: "from_raw_parts(p: ptr<T>, len: int64, [cap: int64]) -> T[]",
    summary: "Constructs a slice or string from raw pointer and length.",
    description: "Unsafe intrinsic creating a slice or string buffer directly from pointer and length.",
    parameters: [
      { name: "p", type: "ptr<T>", description: "Base buffer pointer" },
      { name: "len", type: "int64", description: "Element count" },
      { name: "cap", type: "int64", description: "Optional capacity" }
    ],
    returnType: "T[]",
    example: "set s = from_raw_parts(buf_ptr, 16)"
  },
  from_utf8: {
    name: "from_utf8",
    signature: "from_utf8(bytes: bytes) -> string",
    summary: "Constructs a string from a byte slice.",
    description: "Validates and interprets raw bytes as a UTF-8 string without copying memory buffer.",
    parameters: [{ name: "bytes", type: "bytes", description: "Byte slice buffer" }],
    returnType: "string",
    example: "set str = from_utf8(byte_slice)"
  },
  file: {
    name: "file",
    signature: "file!() -> string",
    summary: "Returns current source file path.",
    description: "Built-in macro returning current source file path relative to project root.",
    parameters: [],
    returnType: "string",
    example: "set path = file!()"
  },
  line: {
    name: "line",
    signature: "line!() -> int32",
    summary: "Returns current line number.",
    description: "Built-in macro returning current line number in source file (1-based).",
    parameters: [],
    returnType: "int32",
    example: "set cur_line = line!()"
  },
  col: {
    name: "col",
    signature: "col!() -> int32",
    summary: "Returns current column number.",
    description: "Built-in macro returning current column number in source file (1-based).",
    parameters: [],
    returnType: "int32",
    example: "set cur_col = col!()"
  },
  yukienv: {
    name: "yukienv",
    signature: "yukienv!(key: string, [scope: int32]) -> string",
    summary: "Reads project environment variable from yuki.toml.",
    description: "Built-in macro returning project configuration variable defined in workspace or project manifest at compile time.",
    parameters: [
      { name: "key", type: "string", description: "Environment variable key" },
      { name: "scope", type: "int32", description: "Optional resolution scope (1: manifest, 2: workspace, 3: host workspace, 4: host manifest)" }
    ],
    returnType: "string",
    example: "static API_URL: string = yukienv!(\"API_URL\")"
  },
  hostenv: {
    name: "hostenv",
    signature: "hostenv!(var: string) -> string",
    summary: "Reads environment variable from host at compile time.",
    description: "Built-in macro embedding value of a host environment variable into the binary at compile time.",
    parameters: [{ name: "var", type: "string", description: "Environment variable name" }],
    returnType: "string",
    example: "static USER: string = hostenv!(\"USER\")"
  },
  get_target: {
    name: "get_target",
    signature: "get_target!() -> string",
    summary: "Returns compile-time target triple.",
    description: "Built-in macro returning target architecture triple (e.g. x86_64-unknown-linux-gnu).",
    parameters: [],
    returnType: "string",
    example: "static TARGET: string = get_target!()"
  },
  get_yukic_version: {
    name: "get_yukic_version",
    signature: "get_yukic_version!() -> string",
    summary: "Returns version string of compiler.",
    description: "Built-in macro returning yukic compiler version.",
    parameters: [],
    returnType: "string",
    example: "static VER: string = get_yukic_version!()"
  },
  get_profileconfig: {
    name: "get_profileconfig",
    signature: "get_profileconfig!(profile: string, key: string) -> string",
    summary: "Reads configuration parameter from yuki.toml profile.",
    description: "Built-in macro extracting profile config from project manifest.",
    parameters: [
      { name: "profile", type: "string", description: "Profile name (e.g. \"release\")" },
      { name: "key", type: "string", description: "Config key name" }
    ],
    returnType: "string",
    example: "static OPT: string = get_profileconfig!(\"release\", \"opt_level\")"
  },
  get_features: {
    name: "get_features",
    signature: "get_features!() -> string",
    summary: "Returns active build features.",
    description: "Built-in macro returning comma-separated list of enabled features.",
    parameters: [],
    returnType: "string",
    example: "static FEATS: string = get_features!()"
  },
  is_lib_connected: {
    name: "is_lib_connected",
    signature: "is_lib_connected!(lib: string) -> bool",
    summary: "Checks if a library is connected to project.",
    description: "Built-in macro returning boolean whether library is linked.",
    parameters: [{ name: "lib", type: "string", description: "Library name" }],
    returnType: "bool",
    example: "static HAS_STD: bool = is_lib_connected!(\"std\")"
  },
  include_str: {
    name: "include_str",
    signature: "include_str!(path: string) -> string",
    summary: "Embeds external UTF-8 file content into binary.",
    description: "Built-in macro embedding file content at compile time as a constant string.",
    parameters: [{ name: "path", type: "string", description: "Relative file path" }],
    returnType: "string",
    example: "static SHADER: string = include_str!(\"shader.glsl\")"
  },
  include_strings: {
    name: "include_strings",
    signature: "include_strings!(path: string) -> string",
    summary: "Embeds external UTF-8 file content into binary (alias for include_str).",
    description: "Built-in macro embedding file content at compile time as a constant string.",
    parameters: [{ name: "path", type: "string", description: "Relative file path" }],
    returnType: "string",
    example: "static SHADER: string = include_strings!(\"shader.glsl\")"
  },
  include_bytes: {
    name: "include_bytes",
    signature: "include_bytes!(path: string) -> bytes",
    summary: "Embeds raw binary file into binary.",
    description: "Built-in macro embedding file bytes at compile time as raw bytes.",
    parameters: [{ name: "path", type: "string", description: "Relative file path" }],
    returnType: "bytes",
    example: "static FONT: bytes = include_bytes!(\"font.ttf\")"
  },
  compile_error: {
    name: "compile_error",
    signature: "compile_error!(message: string) -> never",
    summary: "Triggers a static compile-time error.",
    description: "Built-in macro halting compilation with a custom error message.",
    parameters: [{ name: "message", type: "string", description: "Error message" }],
    returnType: "never",
    example: "compile_error!(\"Unsupported target platform\")"
  },
  cfg: {
    name: "cfg",
    signature: "cfg(...) -> bool",
    summary: "Evaluates compile-time target or feature predicate.",
    description: "Built-in macro returning boolean whether the configuration condition is satisfied.",
    parameters: [{ name: "predicate", type: "expr", description: "Configuration predicate (e.g. target_os = \"linux\")" }],
    returnType: "bool",
    example: "if cfg!(target_os = \"linux\") { space }"
  },
  compile_print: {
    name: "compile_print",
    signature: "compile_print!(message: string) -> void",
    summary: "Prints message to console at compile time.",
    description: "Built-in macro printing a message during compiler macro expansion pass.",
    parameters: [{ name: "message", type: "string", description: "Message to print" }],
    returnType: "void",
    example: "compile_print!(\"Building module...\")"
  }
};

export const YUKINO_STDLIB_FUNCTIONS: Record<string, FunctionDoc> = {
  // std.io
  print: {
    name: "print",
    signature: "print(msg: string)",
    summary: "Prints a string to standard output (stdout).",
    description: "Outputs message to stdout without appending a newline.",
    parameters: [{ name: "msg", type: "string", description: "String to output" }],
    returnType: "void",
    example: "print(\"Hello world!\")",
    module: "std.io"
  },
  println: {
    name: "println",
    signature: "println(msg: string)",
    summary: "Prints a string with newline to standard output (stdout).",
    description: "Outputs message followed by a newline `\\n` to stdout.",
    parameters: [{ name: "msg", type: "string", description: "String to output" }],
    returnType: "void",
    example: "println(\"Score: ${score}\")",
    module: "std.io"
  },
  eprint: {
    name: "eprint",
    signature: "eprint(msg: string)",
    summary: "Prints a string to standard error (stderr).",
    description: "Outputs message to stderr without trailing newline.",
    parameters: [{ name: "msg", type: "string", description: "Error message to output" }],
    returnType: "void",
    example: "eprint(\"Warning: deprecated API\")",
    module: "std.io"
  },
  eprintln: {
    name: "eprintln",
    signature: "eprintln(msg: string)",
    summary: "Prints a string with newline to standard error (stderr).",
    description: "Outputs message followed by a newline to stderr.",
    parameters: [{ name: "msg", type: "string", description: "Error message to output" }],
    returnType: "void",
    example: "eprintln(\"Fatal error occurred\")",
    module: "std.io"
  },
  flush: {
    name: "flush",
    signature: "flush() -> int32",
    summary: "Flushes standard output buffer.",
    description: "Forces any buffered bytes in stdout to be written out immediately.",
    parameters: [],
    returnType: "int32",
    module: "std.io"
  },
  read_line: {
    name: "read_line",
    signature: "read_line() -> string",
    summary: "Reads a single line from standard input.",
    description: "Blocks until a newline is entered in stdin and returns the line string.",
    parameters: [],
    returnType: "string",
    module: "std.io"
  },
  read_char: {
    name: "read_char",
    signature: "read_char() -> char",
    summary: "Reads a single Unicode character from standard input.",
    description: "Reads next Unicode codepoint from stdin.",
    parameters: [],
    returnType: "char",
    module: "std.io"
  },
  read_all: {
    name: "read_all",
    signature: "read_all() -> string",
    summary: "Reads all remaining input from standard input until EOF.",
    description: "Reads everything from stdin until end-of-file is reached.",
    parameters: [],
    returnType: "string",
    module: "std.io"
  },
  is_terminal: {
    name: "is_terminal",
    signature: "is_terminal(stream_id: int32) -> bool",
    summary: "Checks if a stream is attached to an interactive terminal.",
    description: "0 = stdin, 1 = stdout, 2 = stderr. Returns true if stream is a TTY.",
    parameters: [{ name: "stream_id", type: "int32", description: "0 for stdin, 1 for stdout, 2 for stderr" }],
    returnType: "bool",
    module: "std.io"
  },
  poll_stdin: {
    name: "poll_stdin",
    signature: "poll_stdin(timeout_ms: int64) -> bool",
    summary: "Polls stdin for available bytes.",
    description: "Returns true if data is ready to be read from stdin before timeout expires.",
    parameters: [{ name: "timeout_ms", type: "int64", description: "Timeout in milliseconds" }],
    returnType: "bool",
    module: "std.io"
  },
  set_raw_mode: {
    name: "set_raw_mode",
    signature: "set_raw_mode(enable: bool) -> bool",
    summary: "Toggles terminal raw mode.",
    description: "Disables terminal line-buffering and echo for interactive game loops and TUI.",
    parameters: [{ name: "enable", type: "bool", description: "True to enable raw mode, false to restore cooked" }],
    returnType: "bool",
    module: "std.io"
  },
  terminal_size: {
    name: "terminal_size",
    signature: "terminal_size() -> TerminalSize",
    summary: "Gets terminal window dimensions.",
    description: "Returns a struct with `cols` and `rows` integers representing console size.",
    parameters: [],
    returnType: "TerminalSize",
    module: "std.io"
  },

  // std.strings
  is_empty: {
    name: "is_empty",
    signature: "is_empty(s: string) -> bool",
    summary: "Checks if string is empty.",
    description: "Returns true if `s.len() == 0`.",
    parameters: [{ name: "s", type: "string", description: "Input string" }],
    returnType: "bool",
    module: "std.strings"
  },
  byte_at: {
    name: "byte_at",
    signature: "byte_at(s: string, index: int64) -> uint8",
    summary: "Safe byte retrieval at index.",
    description: "Returns byte at `index` or 0 if index is out of bounds.",
    parameters: [
      { name: "s", type: "string", description: "Input string" },
      { name: "index", type: "int64", description: "Zero-based byte index" }
    ],
    returnType: "uint8",
    module: "std.strings"
  },
  char_at: {
    name: "char_at",
    signature: "char_at(s: string, index: int64) -> char",
    summary: "Safe character retrieval at byte index.",
    description: "Returns decoded char at index.",
    parameters: [
      { name: "s", type: "string", description: "Input string" },
      { name: "index", type: "int64", description: "Zero-based index" }
    ],
    returnType: "char",
    module: "std.strings"
  },
  compare: {
    name: "compare",
    signature: "compare(a: string, b: string) -> int32",
    summary: "Lexicographically compares two strings.",
    description: "Returns < 0 if a < b, 0 if a == b, > 0 if a > b.",
    parameters: [
      { name: "a", type: "string", description: "First string" },
      { name: "b", type: "string", description: "Second string" }
    ],
    returnType: "int32",
    module: "std.strings"
  },
  str_join: {
    name: "str_join",
    signature: "str_join(items: string[], delimiter: string) -> string",
    summary: "Joins an array of strings with a delimiter.",
    description: "Concatenates all array items separating them with delimiter.",
    parameters: [
      { name: "items", type: "string[]", description: "Array of strings" },
      { name: "delimiter", type: "string", description: "Separator string" }
    ],
    returnType: "string",
    example: "set text = str_join([\"a\", \"b\"], \", \")",
    module: "std.strings"
  },

  // std.threads
  spawn: {
    name: "spawn",
    signature: "spawn(task: ptr<void>, arg: ptr<void> = null) -> uint64",
    summary: "Spawns a new OS thread.",
    description: "Creates and runs a native background thread executing `task`.",
    parameters: [
      { name: "task", type: "ptr<void>", description: "Function pointer to execute" },
      { name: "arg", type: "ptr<void>", description: "Optional argument pointer" }
    ],
    returnType: "uint64",
    module: "std.threads"
  },
  join: {
    name: "join",
    signature: "join(handle: uint64) -> int32",
    summary: "Joins a background thread.",
    description: "Blocks until thread with given handle finishes execution.",
    parameters: [{ name: "handle", type: "uint64", description: "Thread handle ID" }],
    returnType: "int32",
    module: "std.threads"
  },
  sleep: {
    name: "sleep",
    signature: "sleep(ms: uint64)",
    summary: "Sleeps current thread.",
    description: "Suspends the current thread for specified milliseconds.",
    parameters: [{ name: "ms", type: "uint64", description: "Sleep duration in milliseconds" }],
    returnType: "void",
    module: "std.threads"
  },
  yield_now: {
    name: "yield_now",
    signature: "yield_now()",
    summary: "Yields execution to another thread.",
    description: "Voluntarily gives up remaining CPU time slice.",
    parameters: [],
    returnType: "void",
    module: "std.threads"
  },
  hardware_concurrency: {
    name: "hardware_concurrency",
    signature: "hardware_concurrency() -> uint32",
    summary: "Returns logical CPU core count.",
    description: "Returns the number of logical cores available on host system.",
    parameters: [],
    returnType: "uint32",
    module: "std.threads"
  }
};

export const YUKINO_RECEIVER_METHODS: Record<string, FunctionDoc> = {
  len: {
    name: "len",
    signature: "value.len() -> int64",
    summary: "Returns item count or byte length.",
    description: "Available on `string`, `bytes`, `T[]` slices and maps.",
    parameters: [],
    returnType: "int64",
    example: "set length = str.len()"
  },
  as_ptr: {
    name: "as_ptr",
    signature: "value.as_ptr() -> ptr<T>",
    summary: "Returns raw pointer to underlying buffer.",
    description: "Available on `string`, `bytes`, and arrays for C ABI interaction.",
    parameters: [],
    returnType: "ptr<T>",
    example: "set p = str.as_ptr()"
  },
  cap: {
    name: "cap",
    signature: "value.cap() -> int64",
    summary: "Returns the currently allocated capacity.",
    description: "Available on `bytes` and `[]T` slices; returns the allocated capacity of the slice or byte buffer.",
    parameters: [],
    returnType: "int64",
    example: "set capacity: int64 = buffer.cap()"
  },
  cp: {
    name: "cp",
    signature: "value.cp() -> []T",
    summary: "Deep-copies slice elements.",
    description: "Available on `[]T` slices; clones the elements into the current memory region.",
    parameters: [],
    returnType: "[]T",
    example: "set buffer_copy = buffer.cp()"
  },
  slice: {
    name: "slice",
    signature: "value.slice(start: int64, end: int64) -> T",
    summary: "Sub-slice from start (inclusive) to end (exclusive).",
    description: "Creates a subslice of a string, byte buffer, or array.",
    parameters: [
      { name: "start", type: "int64", description: "Start index" },
      { name: "end", type: "int64", description: "End index" }
    ],
    returnType: "T",
    example: "set sub = str.slice(0, 5)"
  },
  contains: {
    name: "contains",
    signature: "str.contains(sub: string) -> bool",
    summary: "Checks if string contains substring.",
    description: "Returns true if `sub` is found anywhere inside string.",
    parameters: [{ name: "sub", type: "string", description: "Substring to search for" }],
    returnType: "bool"
  },
  starts_with: {
    name: "starts_with",
    signature: "str.starts_with(prefix: string) -> bool",
    summary: "Checks prefix match.",
    description: "Returns true if string starts with `prefix`.",
    parameters: [{ name: "prefix", type: "string", description: "Prefix string" }],
    returnType: "bool"
  },
  ends_with: {
    name: "ends_with",
    signature: "str.ends_with(suffix: string) -> bool",
    summary: "Checks suffix match.",
    description: "Returns true if string ends with `suffix`.",
    parameters: [{ name: "suffix", type: "string", description: "Suffix string" }],
    returnType: "bool"
  },
  index_of: {
    name: "index_of",
    signature: "str.index_of(sub: string) -> int64",
    summary: "Finds first index of substring.",
    description: "Returns index of first match or -1 if not found.",
    parameters: [{ name: "sub", type: "string", description: "Substring to search for" }],
    returnType: "int64"
  },
  last_index_of: {
    name: "last_index_of",
    signature: "str.last_index_of(sub: string) -> int64",
    summary: "Finds last index of substring.",
    description: "Returns last index of match or -1 if not found.",
    parameters: [{ name: "sub", type: "string", description: "Substring to search for" }],
    returnType: "int64"
  },
  replace: {
    name: "replace",
    signature: "str.replace(from: string, to: string) -> string",
    summary: "Replaces all occurrences of substring.",
    description: "Replaces all occurrences of `from` with `to`.",
    parameters: [
      { name: "from", type: "string", description: "Target substring" },
      { name: "to", type: "string", description: "Replacement string" }
    ],
    returnType: "string"
  },
  split: {
    name: "split",
    signature: "str.split(delimiter: string) -> string[]",
    summary: "Splits string by delimiter into an array.",
    description: "Splits string into parts separated by `delimiter`.",
    parameters: [{ name: "delimiter", type: "string", description: "Separator string" }],
    returnType: "string[]"
  },
  lines: {
    name: "lines",
    signature: "str.lines() -> string[]",
    summary: "Splits string into lines.",
    description: "Splits string by `\\n` and `\\r\\n`.",
    parameters: [],
    returnType: "string[]"
  },
  trim: {
    name: "trim",
    signature: "str.trim() -> string",
    summary: "Trims whitespace from both ends.",
    description: "Removes leading and trailing whitespace characters.",
    parameters: [],
    returnType: "string"
  },
  trim_start: {
    name: "trim_start",
    signature: "str.trim_start() -> string",
    summary: "Trims leading whitespace.",
    description: "Removes whitespace from start of string.",
    parameters: [],
    returnType: "string"
  },
  trim_end: {
    name: "trim_end",
    signature: "str.trim_end() -> string",
    summary: "Trims trailing whitespace.",
    description: "Removes whitespace from end of string.",
    parameters: [],
    returnType: "string"
  },
  upper: {
    name: "upper",
    signature: "str.upper() -> string",
    summary: "Converts string to uppercase.",
    description: "Transforms all characters to uppercase.",
    parameters: [],
    returnType: "string"
  },
  lower: {
    name: "lower",
    signature: "str.lower() -> string",
    summary: "Converts string to lowercase.",
    description: "Transforms all characters to lowercase.",
    parameters: [],
    returnType: "string"
  },
  repeat: {
    name: "repeat",
    signature: "str.repeat(count: int64) -> string",
    summary: "Repeats string count times.",
    description: "Duplicates string `count` times.",
    parameters: [{ name: "count", type: "int64", description: "Repeat multiplier" }],
    returnType: "string"
  },
  reverse: {
    name: "reverse",
    signature: "str.reverse() -> string",
    summary: "Reverses string character order.",
    description: "Returns a new string with inverted characters.",
    parameters: [],
    returnType: "string"
  },
  pad_start: {
    name: "pad_start",
    signature: "str.pad_start(len: int64, pad: string = \" \") -> string",
    summary: "Pads string on the left.",
    description: "Pads left side with `pad` string until `len` is reached.",
    parameters: [
      { name: "len", type: "int64", description: "Target length" },
      { name: "pad", type: "string", description: "Pad character/string" }
    ],
    returnType: "string"
  },
  pad_end: {
    name: "pad_end",
    signature: "str.pad_end(len: int64, pad: string = \" \") -> string",
    summary: "Pads string on the right.",
    description: "Pads right side with `pad` string until `len` is reached.",
    parameters: [
      { name: "len", type: "int64", description: "Target length" },
      { name: "pad", type: "string", description: "Pad character/string" }
    ],
    returnType: "string"
  },
  to_int64: {
    name: "to_int64",
    signature: "str.to_int64() -> int64",
    summary: "Parses string to int64.",
    description: "Parses numeric string to integer (0 on error).",
    parameters: [],
    returnType: "int64"
  },
  to_float64: {
    name: "to_float64",
    signature: "str.to_float64() -> float64",
    summary: "Parses string to float64.",
    description: "Parses string into a floating-point number.",
    parameters: [],
    returnType: "float64"
  },
  to_bool: {
    name: "to_bool",
    signature: "str.to_bool() -> bool",
    summary: "Parses string to bool.",
    description: "Returns true for \"true\", \"1\", \"yes\", \"on\".",
    parameters: [],
    returnType: "bool"
  }
};

export interface AttributeDoc {
  name: string;
  syntax: string;
  summary: string;
  description: string;
  example: string;
}

export const YUKINO_ATTRIBUTES: Record<string, AttributeDoc> = {
  inline: {
    name: "inline",
    syntax: "#[inline] or #[inline(always)] or #[inline(never)]",
    summary: "Inlining hint for the compiler optimization pipeline.",
    description: "Controls whether the code generator should inline calls to this function. Supports always and never modifiers.",
    example: "#[inline(always)]\nfun fast_add(a: int32, b: int32) -> int32 { return a + b; }"
  },
  cold: {
    name: "cold",
    syntax: "#[cold]",
    summary: "Marks function as rarely executed.",
    description: "Hints the code generator that this function or branch is unlikely to be taken, optimizing branch prediction for hot paths.",
    example: "#[cold]\nfun handle_rare_error() { ... }"
  },
  cfg: {
    name: "cfg",
    syntax: "#[cfg(predicate)] or #![cfg(predicate)]",
    summary: "Conditional compilation attribute.",
    description: "Includes or excludes items or whole modules based on target architecture, OS, or enabled features.",
    example: "#[cfg(target_os = \"windows\")]\nfun win_init() { ... }"
  },
  test: {
    name: "test",
    syntax: "#[test]",
    summary: "Marks function as a unit test runner entry point.",
    description: "Compiler test harness discovers and executes functions decorated with #[test].",
    example: "#[test]\nfun test_addition() { assert_eq(1 + 1, 2); }"
  },
  deprecated: {
    name: "deprecated",
    syntax: "#[deprecated] or #[deprecated(\"reason\")]",
    summary: "Marks declaration as obsolete.",
    description: "Emits a compiler warning whenever the decorated symbol is referenced in source code.",
    example: "#[deprecated(\"Use new_api instead\")]\nfun old_api() { ... }"
  },
  cdecl: {
    name: "cdecl",
    syntax: "|cdecl|",
    summary: "Standard C calling convention.",
    description: "Applies C declaration calling convention (caller cleans up stack) to cfun declaration.",
    example: "|cdecl| cfun puts(str: ptr<c_char>) -> c_int;"
  },
  stdcall: {
    name: "stdcall",
    syntax: "|stdcall|",
    summary: "Standard Win32 API calling convention.",
    description: "Applies stdcall calling convention (callee cleans up stack) for Windows system API interaction.",
    example: "|stdcall| cfun MessageBoxA(hwnd: ptr<c_void>, text: ptr<c_char>, title: ptr<c_char>, uType: c_uint) -> c_int;"
  },
  packed: {
    name: "packed",
    syntax: "|packed| or #[packed]",
    summary: "Disables memory alignment padding in structs.",
    description: "Packs struct fields contiguously with 1-byte alignment, matching packed C struct memory layouts.",
    example: "|packed| struct Header { id: uint8, size: uint32 }"
  }
};
