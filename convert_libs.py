"""
Convert the .bicicleta/.expected files into a .js that's easy to load.
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
        with open(path) as f:
            text = f.read()
        print '  %r: %r,' % (name, text)
        try:
            f = open(path.replace('.bicicleta', '.expected'))
        except IOError:
            pass
        else:
            with f:
                expected = f.read()
            print '  %r: %r,' % (name+'.expected', expected)
    print '};'


if __name__ == '__main__':
    main()
