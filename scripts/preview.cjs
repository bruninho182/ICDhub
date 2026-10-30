// Prévia local com dados fictícios em memória. Não usa o storage real da extensão.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const fixture = `
const listeners = new Set();
let dados = {
  configMaster: [
    {id:'pix',nome:'Pagamento por PIX',pasta:'Pagamentos',texto:'Olá! Seguem as informações para pagamento por PIX.\\nApós o pagamento, envie o comprovante para continuarmos.'},
    {id:'voucher',nome:'Envio de voucher',pasta:'Reservas',texto:'Seu voucher está pronto! Confira a data e apresente o documento na entrada.'},
    {id:'boas',nome:'Boas-vindas',texto:'Olá! Como posso ajudar a planejar o seu passeio?'}
  ],
  listaPastas:['Pagamentos','Reservas'],
  listaPasseios:[
    {nome:'Trem do Corcovado',ingressos:[{tipo:'Adulto',valor:99.90},{tipo:'Infantil',valor:65},{tipo:'Gratuito',valor:0}]},
    {nome:'Bondinho Pão de Açúcar',ingressos:[{tipo:'Bilhete Normal',valor:150},{tipo:'Acesso rápido',valor:220}]},
    {nome:'Tour Maracanã',ingressos:[{tipo:'Tour Regular',valor:80},{tipo:'Tour Guiado',valor:100}]}
  ]
};
window.chrome = { storage: {local: {
 get(keys, cb) { const res = keys === null ? structuredClone(dados) : Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,structuredClone(dados[k])])); if(cb) cb(res); return Promise.resolve(res); },
 set(value,cb) { Object.assign(dados,structuredClone(value)); listeners.forEach(fn=>fn(Object.fromEntries(Object.keys(value).map(k=>[k,{}])),'local')); if(cb) cb(); return Promise.resolve(); },
 remove(key,cb) { delete dados[key]; if(cb) cb(); return Promise.resolve(); }
 }, onChanged:{addListener(fn){listeners.add(fn)},removeListener(fn){listeners.delete(fn)}}},
 runtime:{getURL(p){return '/'+p},sendMessage(message){if(message.acao==='ABRIR_CONFIGURACOES'){location.href='/options.html#sec-cotacao';return Promise.resolve({ok:true})}return Promise.resolve({ok:false})},onMessage:{addListener(){}}} };
`;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' };
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/preview-fixture.js') { res.setHeader('Content-Type','text/javascript; charset=utf-8'); return res.end(fixture); }
  if (url.pathname === '/cotacao') {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.end('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Prévia da cotação ICDHub</title><body style="background:#e4ece8;font-family:system-ui;padding:30px"><h1>Cotação no atendimento</h1><p>Prévia com tarifários fictícios. Nenhuma mensagem é enviada.</p><script src="/preview-fixture.js"></script><script src="/scripts/generated/cotacao.js"></script><script src="/scripts/generated/cotacao_ui.js"></script><script>ICDCotacaoUI.abrir()</script></body></html>');
  }
  const pathname = url.pathname === '/' ? '/options.html' : url.pathname;
  if (!/^\/(?:options\.html|styles\/[\w.-]+\.css|icons\/[\w.-]+\.png|scripts\/(?:generated\/)?[\w.-]+\.js)$/.test(pathname)) { res.writeHead(404); return res.end(); }
  const file = path.join(base, pathname);
  fs.readFile(file, (err,data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', (types[path.extname(file)] || 'text/plain') + '; charset=utf-8');
    if (pathname === '/options.html') data = data.toString().replace(/<link[^>]+https:\/\/[^>]+>/g,'').replace('<head>','<head><script src="/preview-fixture.js"></script>');
    res.end(data);
  });
}).listen(4178, '127.0.0.1', () => console.log('Prévia local: http://127.0.0.1:4178/options.html e http://127.0.0.1:4178/cotacao'));
