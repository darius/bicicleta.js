/*
Expressions e:

e = {
     type: 'variable|literal|call|extend',

  // Only for type='variable':
     name: '$x'

  // Only for type='literal':
     value: 42

  // Only for type='call':
     receiver: e1,
     slot: '$+'

  // Only for type='extend':
     base: e2,
     name: '$me',    // (optional field, may be null)
     bindings: {$slot1: e1, ...}
    }
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
        var methods = {};
        Object.getOwnPropertyNames(e.bindings).forEach(function(slot) {
            methods[slot] = makeSelfishMethod(e.bindings[slot], e.name, env);
        });
        return evaluate(e.base, env, [extend_k, methods, k]);
    }
    default:
        console.log('Not an expression', e);
        throw new Error("Unknown expression type: " + e);
    }
}

function extend_k(bob, methods, k) {
    return [k, makeBob(bob, methods)];
}

function makeSelfishMethod(e, name, env) {
    return function(_, bob, k) {
        var newEnv = Object.create(env);
        newEnv[name] = bob;
        return evaluate(e, newEnv, k);
    };
}
