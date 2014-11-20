"""
Convert the .bicicleta files into a .js that's easy to load.
(Yes, I should learn the right way to load data files in JS.)
"""

import glob

def main():
    gen('sys')
    gen('examples')

def gen(dirname):
    print 'var %s = {' % dirname
    for path in glob.glob(dirname+'/*.bicicleta'):
        name = path.replace(dirname+'/', '').replace('.bicicleta', '')
        text = open(path).read()
        print '  %r: %r,' % (name, text)
    print '};'

## main()
#. var sys = {
#.   'bool': '...',
#.   'number': '...',
#.   'string': '...',
#.   'sys': '...',
#. };
#. var examples = {
#.   'fib': '...',
#.   'freezer': '...',
#. };

if __name__ == '__main__':
    main()
