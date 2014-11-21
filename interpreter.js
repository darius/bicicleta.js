/*
The env is a JS object with a key for each variable in scope. The key
is '$' + the variable's name. (The parser already adds the '$', we
don't have to.)

TODO: are prototype-based objects faster?
*/

function mkLit(value) {
    return {
        toString: function() {
            return '' + value;
        },
        evaluate: function(env, k) {
            return [k, value];
        },
    };
}

function mkVar(name) {
    return {
        toString: function() {
            return name.slice(1); // TODO: don't require a '$' for mkVar's parameter anymore
        },
        evaluate: function(env, k) {
            var value = env[name];
            if (value === undefined)
                throw new Error("Unbound variable: " + name);
            return [k, value];
        },
    };
}

function mkCall(receiver, slot) {
    return {
        toString: function() {
            return ''+receiver+'.'+slot.slice(1);
        },
        evaluate: function(env, k) {
            return receiver.evaluate(env, [call, slot, k]);
        },
    };
}

function mkExtend(base, name, bindings) {
    // Two cases, just for efficiency:
    var makeMethod = name === null ? makeSelflessMethod : makeSelfishMethod;
    return {
        toString: function() {
            var s = ''+base + '{';
            if (name) s += name.slice(1) + ': ';
            var sep = '';
            for (var slot in bindings) {
                s += sep + slot.slice(1) + '=' + bindings[slot];
                sep = ', ';
            }
            s += '}'
            return s;
        },
        evaluate: function(env, k) {
            var methods = {};
            for (var slot in bindings) // XXX for..in gives us only actual slots, right?
                methods[slot] = makeMethod(bindings[slot], name, env);
            return base.evaluate(env, [extendK, methods, k]);
        },
    };
}

function extendK(bob, methods, k) {
    return [k, makeBob(bob, methods)];
}

function makeSelflessMethod(e, _, env) {
    return function(_, bob, k) {
        return e.evaluate(env, k);
    };
}

function makeSelfishMethod(e, name, env) {
    return function(_, bob, k) {
        var newEnv = Object.create(env);
        newEnv[name] = bob;
        return e.evaluate(newEnv, k);
    };
}
