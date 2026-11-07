// sundial: stamp the build, so the page can say when it was made.
var fs = require('fs');

var stamp = { builtAt: new Date().toISOString() };
fs.writeFileSync(__dirname + '/build.json', JSON.stringify(stamp));
process.stdout.write('stamped ' + stamp.builtAt + '\n');
