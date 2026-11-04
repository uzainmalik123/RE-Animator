// guestbook: sign it on your way out.
var http = require('http');
var qs = require('querystring');

var port = process.env.PORT || 3000;
var host = process.env.HOST || '127.0.0.1';
var entries = [];

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function page() {
  var list = entries.map(function (e) {
    return '<li><b>' + escape(e.name) + '</b>: ' + escape(e.message) + '</li>';
  }).join('');
  return '<!doctype html><html><head><meta charset="utf-8"><title>Guestbook</title></head><body>' +
    '<h1>Guestbook</h1>' +
    '<form method="post" action="/sign">' +
    '<label>Name <input name="name"></label> ' +
    '<label>Message <input name="message"></label> ' +
    '<button type="submit">Sign</button>' +
    '</form>' +
    '<ul>' + list + '</ul>' +
    '</body></html>';
}

var server = http.createServer(function (req, res) {
  if (req.method === 'POST' && req.url === '/sign') {
    var body = '';
    req.on('data', function (chunk) { body += chunk; });
    req.on('end', function () {
      var form = qs.parse(body);
      entries.push({ name: form.name, message: form.message });
      res.writeHead(303, { Location: '/' });
      res.end();
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page());
});

server.listen(port, host, function () {
  console.log('guestbook listening on http://' + host + ':' + port);
});
