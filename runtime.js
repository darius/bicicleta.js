function assert(claim, plaint) {
    if (!claim)
        throw new Error(plaint);
}

// The trampoline reifies execution state to avoid stack overflow and
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
// present the corresponding freeVar to the user.
//
// I had some thoughts about interpreter/compiler interoperability
// too, but I'd need to see my old notes. Also: it'd probably be
// more efficient with a mutable stack instead of consing up
// continuations; this way was just easier for me to write.
// 
// Pass trace=true to get console logs.
function trampoline(state, trace) {
    var k, value, fn, freeVar;
    k = state[0], value = state[1];
    if (trace) {
        while (k !== null) {
            whatsBouncing(k, value);
            if (k.length !== 3) throw new Error("bad cont!");
            fn = k[0], freeVar = k[1], k = k[2];
            state = fn(value, freeVar, k);
            k = state[0], value = state[1];        
        }
    } else {
        while (k !== null) {
            fn = k[0], freeVar = k[1], k = k[2];
            if (typeof(fn) !== 'function') {
                console.log("Bad state", fn, freeVar, k);
                throw new Error("Not a function: " + fn);
            }
            state = fn(value, freeVar, k);
            k = state[0], value = state[1];        
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
// implementation or by JS.) The root parent is null.
//
// (Representing primitive objects as themselves made a big difference
// in performance for the Python version. I assume it has the same
// advantage here.)


// Compute the given slot of a Bicicleta object, caching the result
// unless bob is primitive. The computation takes two steps: look up
// the method and then call it. A method is a trampolined JS
// function(ancestor, bob, k) where ancestor is the object directly
// holding the method definition, while bob is the 'self', the object
// we're calling.
function call(bob, slot, k) {
    // This implementation could avoid breaking out the mirandaMethods
    // case, if the contents of mirandaMethods were added to every
    // primitive-type methods table and to rootBob's. But it's simpler
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

function extendK(bob, methods, k) {
    return [k, makeBob(bob, methods)];
}

var rootBob = makeBob(null, {}); // XXX just null would do, right?

function makePrimCall(receiver) {
    // TODO do it like "new PrimCall" to make this cheaper
    return {receiver: receiver,
            parent: rootBob,
            methods: {'$()': function(me, doing, k) { // XXX checkme
                return call(doing, '$arg1', [prim_call_k, me, k]); }}};
}
function prim_call_k(arg1, me, k) {
    if (typeof(arg1) !== 'string')
        throw new Error("Non-string slot: " + arg1);
    return call(me.receiver, '$'+arg1, k);
}

var mirandaMethods = {
    '$is_number': function(_, me, k) { return [k, false]; },
    '$is_string': function(_, me, k) { return [k, false]; },
    '$repr':      function(_, me, k) { return [k, ''+me]; }, // XXX improve me
    '$str':       function(_, me, k) { return [k, ''+me]; }, // XXX improve me
    '$reflective slot value': function(_, me, k) { return [k, makePrimCall(me)]; },
};


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


function makePrimopMethod(primK) {
    return function(ancestor, me, k) {
        // XXX this could allocate less, using prototypes
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
    '$+':  makePrimopMethod(primAddK),
    '$-':  makePrimopMethod(primSubK),
    '$*':  makePrimopMethod(primMulK),
    '$/':  makePrimopMethod(primDivK),
    '$**': makePrimopMethod(primPowK),
    '$==': makePrimopMethod(primEqK),
    '$<':  makePrimopMethod(primLtK),
};

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

var primitiveMethodTables = {
    'boolean': booleanMethods,
    'number':  numberMethods,
    'string':  stringMethods,
};
