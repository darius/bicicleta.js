var program_grammar = "                                             \
program     = expr _ !.                                             \
expr        = factor infixes                attach_all              \
factor      = primary affixes               attach_all              \
                                                                    \
primary     = name                          VarRef                  \
            | _ (\\d*\\.\\d+)               float Literal           \
            | _ (\\d+)                      int   Literal           \
            | _ \"([^\"\\\\]*)\"                  Literal           \
            | _ \\( _ expr \\)                                      \
            | empty extend                  attach                  \
                                                                    \
affixes     = affix affixes |                                       \
affix       = _ [.] name                    defer_dot               \
            | extend                                                \
            | _ \\( bindings _ \\)          defer_funcall           \
            | _ \\[ bindings _ \\]          defer_squarecall        \
                                                                    \
extend      = _ { name _ : bindings _ }     defer_extend            \
            | _ {          bindings _ }     defer_selfless_extend   \
bindings    = binds                         name_positions          \
binds       = binding newline binds                                 \
            | binding _ , binds                                     \
            | binding                                               \
            |                                                       \
binding     = name _ [=] expr               hug                     \
            | positional expr               hug                     \
                                                                    \
infixes     = infix infixes |                                       \
infix       = infix_op factor               defer_infix             \
infix_op    = _ !lone_eq opchars                                    \
opchars     = ([-~`!@$%^&*+<>?/|\\\\=]+)    quote                   \
lone_eq     = [=] !opchars                                          \
                                                                    \
name        = _ ([A-Za-z_][A-Za-z_0-9]*)    quote                   \
            | _ '([^'\\\\]*)'               quote                   \
                                                                    \
newline     = blanks \\n                                            \
blanks      = blank blanks |                                        \
blank       = !\\n (?:\\s|#.*)                                      \
                                                                    \
_           = (?:\\s|#.*)*                                          \
";

function attach(expr, affix) {
    return affix[0].apply(null, [expr].concat(affix.slice(1)));
}

var parseProgram = parseGrammar(program_grammar, {
    empty:            function()               { return mkLit(rootBob); },
    positional:       function()               { return null; },
    attach_all:       function(expr) {
        var result = expr;
        for (var i = 1; i < arguments.length; ++i)
            result = attach(result, arguments[i]);
        return result;
    },
    VarRef:           mkVar,
    'float':          parseFloat,
    'int':            parseInt,
    Literal:          mkLit,
    attach:           attach,
    defer_dot:        function(name)           { return [mkCall, name]; },
    defer_funcall:    function(bindings)       { return [mkFunCall, '$()', bindings]; },
    defer_squarecall: function(bindings)       { return [mkFunCall, '$[]', bindings]; },
    defer_extend:     function(name, bindings) { return [mkExtend, name, bindings]; },
    defer_selfless_extend: function(bindings)  { return [mkExtend, null, bindings]; },
    name_positions:   function() {
        var result = {};
        for (var i = 0; i < arguments.length; ++i) {
            var slot = arguments[i][0];
            var name = slot === null ? '$arg'+(i+1) : slot;
            result[name] = arguments[i][1];
        }
        return result;
    },
    hug: hug,
    defer_infix:      function(operator, expr) { return [mkInfix, operator, expr]; },
    quote:            function(name) { return '$'+name; },
});

function mkFunCall(e, slot, args) {
    //  foo(x=y) ==> foo{x=y}.'()'
    return mkCall(mkExtend(e, null, args), slot);
}

function mkInfix(left, operator, right) {
    //   x + y ==> x.'+'(_=y)
    return mkFunCall(mkCall(left, operator), '$()', {'$arg1': right});
}
