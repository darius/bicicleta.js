'use strict';

function testRun() {
    var body = document.getElementById("codearea").value;
    try { alert(topLevelEval(body)); }
    catch (error) { alert(error); }
}

function topLevelEval(text) {
    var expr = parseProgram(text)[0];
    return trampoline(evaluate(expr, globalEnv, null),
                      false);
}

var sysBob = makeBob(rootBob, {
    '$true':  function(_, me, k) { return [k, true]; },
    '$false': function(_, me, k) { return [k, false]; },
});
var globalEnv = {'$sys': sysBob};

// We incorporate these interpreted methods by mutating the primitive
// method tables, because:
//   * We want to be able to test the system with just the core
//     primitives and no library.
//   * We don't want to slow down the primitive types by extending each
//     'real' primitive with a bob-wrapper that adds the library methods.
// 
// TODO: add some interpreted miranda methods too.

function extendInPlace(methods, overlay) {
    // TODO: deep copy? Shallow is all we need for now.
    Object.getOwnPropertyNames(overlay.methods).forEach(function(slot) {
        if (methods[slot] !== undefined)
            throw new Error("Redefining " + slot);
        methods[slot] = overlay.methods[slot];
    });
}

extendInPlace(booleanMethods, topLevelEval(libs.bool));
extendInPlace(numberMethods,  topLevelEval(libs.number));
extendInPlace(stringMethods,  topLevelEval(libs.string));

extendInPlace(sysBob.methods, topLevelEval(libs.sys));

document.onkeypress = function(e) {
    // Intercept ctrl-Y; when you see it, call testRun().
    if (e.ctrlKey && (e.charCode === 121 || e.charCode === 25)) {
        testRun();
        return false;
    }
    return true;
}


// Older test scaffolding follows, not currently used.

function makeFac(n) {
    return "{env:                                                    \n\
 fac = {fac:   # fac for factorial                                       \n\
        '()' = (fac.n == 0).if(so = 1,                                   \n\
                               else = fac.n * env.fac(n = fac.n-1))}     \n\
}.fac(n=" + n + ")";
}

function testMe() {
    var expr = makeFac("2+3");
    return topLevelEval(expr);
}
