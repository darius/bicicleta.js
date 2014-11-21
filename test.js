'use strict';

function testRun() {
    var body = document.getElementById("codearea").value;
    try { alert(topLevelEval(body)); }
    catch (error) { alert(error); }
}

function topLevelEval(text) {
    var expr = parseProgram(text)[0];
    return trampoline(expr.evaluate(globalEnv, null),
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

extendInPlace(booleanMethods, topLevelEval(sys.bool));
extendInPlace(numberMethods,  topLevelEval(sys.number));
extendInPlace(stringMethods,  topLevelEval(sys.string));

extendInPlace(sysBob.methods, topLevelEval(sys.sys));

document.onkeypress = function(e) {
    // Intercept ctrl-Y; when you see it, call testRun().
    if (e.ctrlKey && (e.charCode === 121 || e.charCode === 25)) {
        testRun();
        return false;
    }
    return true;
}


// Benchmark

function bench() {
    timeExample('fac');
    timeExample('tarai');
    timeExample('itersum3');
    timeExample('fib');
    timeExample('tak');
    timeExample('freezer');
}

var badResult;

function timeExample(name) {
    var expr = parseProgram(examples[name])[0];
    var result;
    var dt = timex(function() {
        result = trampoline(expr.evaluate(globalEnv, null),
                            false);
    });
    var expected = examples[name+'.expected'];
    if (expected !== undefined && expected !== ''+result) {
        console.log('FAILED', name, dt, '; see badResult');
        badResult = result;
    } else if (expected === undefined)
        console.log('Completed', name, dt, result);
    else
        console.log('OK', name, dt);
}

function timex(thunk) {
    var start = Date.now();
    var result = thunk();
    var end = Date.now();
    return end - start;
}
