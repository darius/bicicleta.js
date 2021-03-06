function assert(claim, plaint) {
    if (!claim)
        throw new Error(plaint);
}

// The trampoline reifies execution state to avoid JS stack overflow and
// perhaps also to help support a debugging UI. To work with this,
// functions must be written in 'trampolined style': 
//   function fn(argument, freeVariable, continuation) {
//       ...
//       return [maybeAnotherContinuation, value];
//   }
// A state is a pair [continuation, value], so fn here returns a state.
// The state represents the action "call the continuation with the value".
// 
// A continuation k is either null (for the top level: "return the value")
// or a triple [fn, freeVariable, k] which represents the function 
//     value => fn(value, freeVariable, k)
// where value is the argument to the continuation, and fn should
// return a state, as above.
// 
// The freeVariable argument is technically unnecessary to this
// protocol, since JS has closures: instead of passing different
// free-variable values to the same function, you could create a
// different closure for each. So why do we have it? The minor reason
// is speed: this might need less consing, but I haven't measured
// it. The real reason is so continuations are fully inspectable: you
// should be able to take a continuation and walk back up its 'stack'
// and understand what it's waiting to do at every level. There should
// be a finite set of possible functions that might appear in the fn
// position, so a debugger can look one up and thereby know how to
// present the corresponding freeVar to the user. (Actually, since the
// interpreter creates new method closures all the time, we don't
// currently satisfy that condition.)
//
// I had some thoughts about interpreter/compiler interoperability
// too, but I'd need to see my old notes. The goal was: compiled code
// should be able to take large bounces before hitting the trampoline,
// but transparently to the debugger: if you interrupt it, it should
// be as if you've been interpreting all along. (Added: this new paper
// http://www.lifl.fr/dyla14/papers/dyla14-3-Debugging_at_Full_Speed.pdf
// addresses the same problem.)
// 
// Also: it'd probably be more efficient with a mutable stack instead
// of consing up continuations; this way was just easier for me to
// write.
// 
// Pass trace=true to get console logs.
function trampoline(state, trace) {
    var k, value, fn, freeVar;
    if (trace) {
        for (;;) {
            k = state[0], value = state[1];
            if (k === null) break;
            whatsBouncing(k, value);
            if (k.length !== 3) throw new Error("bad cont!");
            fn = k[0], freeVar = k[1], k = k[2];
            state = fn(value, freeVar, k);
        }
    } else {
        for (;;) {
            k = state[0], value = state[1];
            if (k === null) break;
            fn = k[0], freeVar = k[1], k = k[2];
            if (typeof(fn) !== 'function') {
                console.log("Bad state", fn, freeVar, k);
                throw new Error("Not a function: " + fn);
            }
            state = fn(value, freeVar, k);
        }
    }
    return value;
}

function whatsBouncing(k, value) {
    console.log(':', value);
    while (k) {
        console.log(k[0], ' / ', k[1]);
        k = k[2];
    }
    console.log();
}

// A Bicicleta object ('bob') can be a JS primitive like a number or a
// string, or else a JS object with parent and methods keys. In the
// latter case, slot values are cached directly as keys of the object,
// when first computed. The slot name always has a '$' prepended, in
// the cache, the methods table, the argument to call(), and the AST.
// (This is of course to avoid clashing with keys used by the
// implementation or by JS.) An object inherits methods from its
// parent, but not cached values. The root parent is null.
//
// (Representing primitive objects as themselves made a big difference
// in performance for the Python version. I assume it has the same
// advantage here.)
//
// TODO: try using the JS prototype for the parent, and storing the
// cache in a '.cache' field instead. Have we tried that already?
// Presumably not with more-realistic benchmarks.


// Compute the given slot of a Bicicleta object, caching the result
// unless bob is primitive. The computation takes two steps: look up
// the method and then call it. A method is a trampolined JS function
// of (ancestor, bob, k) where ancestor is the object directly holding
// the method definition, while bob is the 'self', the object we're
// calling.
function call(bob, slot, k) {
    // This implementation could avoid breaking out the mirandaMethods
    // case, if the contents of mirandaMethods were added to every
    // primitive-type methods-table and to rootBob's (rootBob would
    // need to be an actual object instead of null). But it's simpler
    // and more robust to keep them in one place, albeit probably
    // slower.
    var value, ancestor, method;
    if (typeof(bob) === 'object') {
        value = bob[slot];
        if (value !== undefined)
            return [k, value];
        ancestor = bob;
        for (;;) {
            method = ancestor.methods[slot];
            if (method !== undefined)
                break;
            if (ancestor.parent === null) {
                method = mirandaMethods[slot];
                if (method === undefined) {
                    console.log('For', bob);
                    throw new Error("Undefined slot: " + slot);
                }
                break;
            }
            ancestor = ancestor.parent;
            if (typeof(ancestor) !== 'object') {
                method = primitiveMethodTables[typeof(ancestor)][slot];
                if (method === undefined) {
                    method = mirandaMethods[slot];
                    if (method === undefined) {
                        console.log('For', bob);
                        throw new Error("Undefined slot: " + slot);
                    }
                }
                break;
            }
        }
        return method(ancestor, bob, [cacheSlotK, [bob, slot], k]);
    } else {
        method = primitiveMethodTables[typeof(bob)][slot];
        if (method === undefined)
            method = mirandaMethods[slot];
        if (method === undefined) {
            console.log('For', bob);
            throw new Error("Undefined slot: " + slot);
        }
        return method(bob, bob, k);
    }
}

function cacheSlotK(value, freeVar, k) {
    freeVar[0][freeVar[1]] = value;
    return [k, value];
}

function makeBob(parent, methods) {
    return {parent: parent,
            methods: methods};
}

var rootBob = null;


// Miranda methods are the methods on rootBob (and on primitive values
// too).

var mirandaMethods = {
    '$is_number': function(_, me, k) { return [k, false]; },
    '$is_string': function(_, me, k) { return [k, false]; },
    '$repr':      function(_, me, k) { return [k, ''+me]; }, // XXX improve me
    '$str':       function(_, me, k) { return [k, ''+me]; }, // XXX improve me
    '$reflective slot value':
                  function(_, me, k) { return [k, makePrimCall(me)]; },
};

function makePrimCall(receiver) {
    // TODO use a prototype hoisting the constant receiver and
    // methods, to make this cheaper. But I don't suppose this is
    // used often enough to matter.
    return {receiver: receiver,
            parent: rootBob,
            methods: {'$()': function(me, doing, k) {
                return call(doing, '$arg1', [primCallK, me, k]); }}};
}
function primCallK(arg1, me, k) {
    if (typeof(arg1) !== 'string')
        throw new Error("Non-string slot: " + arg1);
    return call(me.receiver, '$'+arg1, k);
}


// Extra methods for boolean values.
// These don't have to be primitive JS methods -- they could be
// defined in the library instead. But this lets us do basic testing
// before loading the standard library, and it may be faster.

var pickSo = makeBob(null, {
    '$()': function(_, doing, k) { return call(doing, '$so', k); },
});
var pickElse = makeBob(null, {
    '$()': function(_, doing, k) { return call(doing, '$else', k); },
});
var booleanMethods = {
    '$if': function(_, me, k) {
        return [k, (me ? pickSo : pickElse)];
    },
};


// In the Python version '+' did double-dispatch, just to make sure
// that'd work, since I don't know what Kragen wants in detail. Here
// we just assume arithmetic, etc., is only done on primitives.

function makePrimopMethod(primK) {
    return function(ancestor, me, k) {
        // TODO this could allocate less, using prototypes, since the
        // parent and methods fields are always the same -- they'd go
        // in the prototype. I tried this, and it seemed slightly
        // faster, but I'm not sure since the run-to-run variance is
        // so high. So let's keep it as a simple object literal for now.
        return [k, {parent: null,
                    methods: primopMethods,
                    primK: primK,
                    primval: ancestor}];
    };
}
var primopMethods = {
    '$()': function(me, doing, k) {
        return call(doing, '$arg1', [me.primK, me, k]);
    },
};


// Extra methods for number values.

function primAddK(arg1, me, k) {
    if (typeof(arg1) !== 'number') throw new Error("Type mismatch");
    return [k, me.primval + arg1];
}
function primSubK(arg1, me, k) {
    if (typeof(arg1) !== 'number') throw new Error("Type mismatch");
    return [k, me.primval - arg1];
}
function primMulK(arg1, me, k) {
    if (typeof(arg1) !== 'number') throw new Error("Type mismatch");
    return [k, me.primval * arg1];
}
function primDivK(arg1, me, k) {
    if (typeof(arg1) !== 'number') throw new Error("Type mismatch");
    return [k, me.primval / arg1];
}
function primPowK(arg1, me, k) {
    if (typeof(arg1) !== 'number') throw new Error("Type mismatch");
    return [k, Math.pow(me.primval, arg1)];
}
function primEqK(arg1, me, k) {
    return [k, me.primval === arg1];
}
function primLtK(arg1, me, k)  {
    if (typeof(me.primval) !== typeof(arg1))
        throw new Error("Type mismatch");
    return [k, me.primval < arg1];
}

var numberMethods = {
    '$is_number': function(_, me, k) { return [k, true]; },
    '$+':         makePrimopMethod(primAddK),
    '$-':         makePrimopMethod(primSubK),
    '$*':         makePrimopMethod(primMulK),
    '$/':         makePrimopMethod(primDivK),
    '$**':        makePrimopMethod(primPowK),
    '$==':        makePrimopMethod(primEqK),
    '$<':         makePrimopMethod(primLtK),
};


// Extra methods for string values.

function primStringCatK(arg1, me, k) {
    if (typeof(arg1) !== 'string')
        throw new Error("Type mismatch");
    return [k, me.primval + arg1];
}

var stringMethods = {
    '$is_string': function(_, me, k) { return [k, true]; },
    '$is_empty':  function(ancestor, me, k) { return [k, ancestor === ''] },
    '$first':     function(ancestor, me, k) { return [k, ancestor[0]] },
    '$rest':      function(ancestor, me, k) { return [k, ancestor.slice(1)] },
    '$==':        makePrimopMethod(primEqK),
    '$<':         makePrimopMethod(primLtK),
    '$++':        makePrimopMethod(primStringCatK),
};


// And yay here are all the primitive types:
var primitiveMethodTables = {
    'boolean': booleanMethods,
    'number':  numberMethods,
    'string':  stringMethods,
};
