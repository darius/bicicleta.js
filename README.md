bicicleta.js
============

Kragen's Bicicleta now all in Javascript

Prehistory: https://github.com/darius/ychacks/tree/master/bicicleta
Still to port over: parts of https://github.com/darius/bicicleta.py

## Quick start

Run `make` and open test.html.

## TO DO

(I'm not promising any of this now...)

* improve number formatting:
  the usual difference from Python's is just more digits of precision,
  which is only a nuisance for comparing outputs; but also we get stuff
  like "16.0" instead of "16". Unfortunately the built-in number.toPrecision()
  doesn't help.
* more testing/benchmarks
* tune the cruder bits of the runtime
* improve repr/str methods?
* port the compiler
