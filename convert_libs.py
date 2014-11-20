"""
Convert the .bicicleta files into a .js that's easy to load.
(Yes, I should learn the right way to load data files in JS.)
"""

import os

def main():
    print 'var sys = {'
    for filename in os.listdir('sys'):
        name = filename.replace('.bicicleta', '')
        text = open('sys/'+filename).read()
        print '  %r: %r,' % (name, text)
    print '};'

## main()
#. var libs = {
#.   'bool': '...',
#.   'number': '...',
#.   'string': '...',
#.   'sys': '...',
#. };

if __name__ == '__main__':
    main()
