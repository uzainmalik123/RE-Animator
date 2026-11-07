// sundial: what time is it?
var http = require('http');
var fs = require('fs');

var port = process.env.PORT || 3000;
var host = process.env.HOST || '127.0.0.1';
var built = JSON.parse(fs.readFileSync(__dirname + '/build.json', 'utf8')).builtAt;

function page(now) {
  return '<!doctype html><html><head><meta charset="utf-8"><title>Sundial</title></head><body>' +
    '<h1>Sundial</h1>' +
    '<p>The time is <time datetime="' + now.toISOString() + '">' + now.toISOString().slice(11, 19) + ' UTC</time>.</p>' +
    '<p><a href="/">Look again</a></p>' +
    '<p><small>Built ' + built + '</small></p>' +
    '</body></html>';
}

var server = http.createServer(function (req, res) {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(new Date()));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Nothing is here.');
});

server.listen(port, host, function () {
  console.log('sundial listening on http://' + host + ':' + port);
});
