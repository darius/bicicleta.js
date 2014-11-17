function assert(claim, plaint) {
    if (!claim)
        throw new Error(plaint);
}

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

function call(bob, slot, k) {
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

var mirandaMethods = {
    '$is_number': function(_, me, k) { return [k, false]; },
    '$is_string': function(_, me, k) { return [k, false]; },
    '$repr':      function(_, me, k) { return [k, '<Bob XXX>']; },
    '$str':       function(_, me, k) { return [k, '<Bob XXX>']; },
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
