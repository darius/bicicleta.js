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
        compile: function(codeK) {
            return genContinue(codeK, genRepr(value));
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
        compile: function(codeK) {
            return genContinue(codeK, genName(name));
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
        compile: function(codeK) {
            return receiver.compile(genPushCont('call', genString(slot), codeK));
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
        compile: function(codeK) {
            var me = name === null ? '__' : genName(name);
            var s = '{';
            var sep = '';
            for (var slot in bindings) {
                s += sep + genRepr(slot) + ': function(_, ' + me + ', k) { return ';
                s += bindings[slot].compile('k');
                s += '; }';
                sep = ', ';
            }
            s += '}';
            var codeMethods = s;
            return base.compile(genPushCont('extendK', codeMethods, codeK));
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


// Compiler

function compile(expr, codeK) {
    if (codeK === undefined) codeK = 'null';
    return render(expr.compile(codeK));
}

function render(code) {
    if (typeof(code) === 'string')
        return code;
    else {
        assert(code.length === 3);
        return ('[' + render(code[0])
                + ', ' + render(code[1])
                + ', ' + render(code[2]) + ']');
    }
}

function genContinue(codeK, codeV) {
    if (typeof(codeK) === 'string')
        return ('[' + codeK
                + ', ' + render(codeV) + ']');
    else {
        assert(codeK.length === 3);
        var fn = codeK[0], fv = codeK[1], k = codeK[2];
        if (fn === 'extendK')
            return genContinue(k, ('makeBob(' + render(codeV)
                                   + ', ' + render(fv)));
        else
            return render(fn) + ('(' + render(codeV)
                                 + ', ' + render(fv)
                                 + ', ' + render(k) + ')');
    }
}

function genPushCont(codeFn, codeFreeVar, codeK) {
    return [codeFn, codeFreeVar, codeK];
}

function genName(name) {
    return name + '_b';  // XXX translate non-alphanumeric names to legal JS ones too
}

function genRepr(value) {
    if (value === rootBob)
        return 'rootBob';
    else if (typeof(value) === 'string')
        return genString(value);
    else if (typeof(value) === 'boolean' || typeof(value) === 'number')
        return ''+value;
    else
        throw new Error("Unknown literal type: " + value);
}

function genString(s) {
    return '"' + s + '"'; // XXX escaping
}
