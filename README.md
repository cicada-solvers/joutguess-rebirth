## JOutguess Rebirth

JOutguess is a web-based tool to extract messages from images embedded using the command-line `outguess` utility. Originaly developped by crashdemons, it went offline in 2022.

This project is a loosely-inspired replacement tool. 

### Building

1. Clone this project, making sure to clone recursively the `outguess` submodule.
2. `cd outguess/`
3. Patch the source code: `patch -p 1 < ../outguess.patch`
4. Run `./autogen.sh` to generate `./configure`
5. Configure: `emconfigure ./configure --with-generic-jconfig`
6. Compile all object files: `emmake make`
7. Generate `outguess.wasm` and `outguess.js` from the object files in the project root: `emcc src/arc.o src/golay.o src/iterator.o src/jpg.o src/md5.o src/outguess.o src/pnm.o **/**/*.o -sEXPORTED_FUNCTIONS=_malloc,_free -o ../outguess.js`

### Licence
Copyright 2023 tweqx

This code is released under the [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html).
