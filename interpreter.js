/*
Expressions e:

e  = {type: 'variable',
      name: '$x'}
   | {type: 'literal',
      value: 42}
   | {type: 'call',
      receiver: e1,
      slot: '$+'}
   | {type: 'extend',
      base: e2,
      name: '$me',    // (optional field, may be null)
      bindings: {$slot1: e1, ...}}

The env is a JS object with a key for each variable in scope. The key
is '$' + the variable's name. (The parser already adds the '$', we
don't have to.)

TODO: represent the AST as objects, so then the case dispatch wouldn't
be a switch statement on a string -- I figure JS is better optimized
for objects.
*/

function evaluate(e, env, k) {
    switch (e.type) {
    case 'variable': {
        var value = env[e.name];
        if (value === undefined)
            throw new Error("Unbound variable: " + e.name);
        return [k, value];
    }
    case 'literal':
        return [k, e.value];

    case 'call':
        return evaluate(e.receiver, env, [call, e.slot, k]);

    case 'extend': {
        // TODO: I guess we could use for..in loops? And that'd be faster?
        var methods = {};
        // Two cases, just for efficiency.
        if (e.name === null)
            Object.getOwnPropertyNames(e.bindings).forEach(function(slot) {
                methods[slot] = makeSelflessMethod(e.bindings[slot], env);
            });
        else
            Object.getOwnPropertyNames(e.bindings).forEach(function(slot) {
                methods[slot] = makeSelfishMethod(e.bindings[slot], e.name, env);
            });
        return evaluate(e.base, env, [extendK, methods, k]);
    }
    default:
        console.log('Not an expression', e);
        throw new Error("Unknown expression type: " + e);
    }
}

function extendK(bob, methods, k) {
    return [k, makeBob(bob, methods)];
}

function makeSelflessMethod(e, env) {
    return function(_, bob, k) {
        return evaluate(e, env, k);
    };
}

function makeSelfishMethod(e, name, env) {
    return function(_, bob, k) {
        var newEnv = Object.create(env);
        newEnv[name] = bob;
        return evaluate(e, newEnv, k);
    };
}
