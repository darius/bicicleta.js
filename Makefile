all: libs.js

libs.js: convert_libs.py sys/bool.bicicleta sys/number.bicicleta sys/string.bicicleta sys/sys.bicicleta
	python convert_libs.py >libs.js
