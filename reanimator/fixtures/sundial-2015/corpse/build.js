// sundial: stamp the build, so the page can say when it was made.
var fs = require('fs');
var util = require('util');

var stamp = { builtAt: new Date().toISOString() };
fs.writeFileSync(__dirname + '/build.json', JSON.stringify(stamp));
util.print('stamped ' + stamp.builtAt + '\n');
