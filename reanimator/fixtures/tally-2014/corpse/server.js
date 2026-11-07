// tally: count yourself in.
var http = require('http');

var port = process.env.PORT || 3000;
var host = process.env.HOST || '127.0.0.1';
var count = 0;

// Every count announces itself on the tally's own emitter.
var tally = new process.EventEmitter();
tally.on('hit', function (n) {
  console.log('hit number ' + n);
});

function page() {
  return '<!doctype html><html><head><meta charset="utf-8"><title>Tally</title></head><body>' +
    '<h1>Tally</h1>' +
    '<p><output id="count">' + count + '</output> so far.</p>' +
    '<form method="post" action="/hit"><button type="submit">Count me in</button></form>' +
    '</body></html>';
}

var server = http.createServer(function (req, res) {
  if (req.method === 'POST' && req.url === '/hit') {
    count += 1;
    tally.emit('hit', count);
    res.writeHead(303, { Location: '/' });
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page());
});

server.listen(port, host, function () {
  console.log('tally listening on http://' + host + ':' + port);
});
