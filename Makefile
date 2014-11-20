all: libs.js

clean:
	rm -f libs.js

libs.js: convert_libs.py sys/*.bicicleta
	python convert_libs.py >libs.js
