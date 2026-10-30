// Gera um ZIP de distribuição usando apenas Node.js e arquivos alcançáveis pelo manifesto/interface.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const arquivos = new Map();
function adicionar(nome, conteudo) {
  nome = path.posix.normalize(nome.replaceAll('\\', '/'));
  if (nome.startsWith('../') || path.isAbsolute(nome)) throw Error('Caminho inválido: ' + nome);
  if (arquivos.has(nome)) return;
  const buffer = conteudo || fs.readFileSync(path.join(root, nome));
  arquivos.set(nome, buffer);
  const texto = buffer.toString('utf8');
  if (/\.html$/.test(nome)) {
    for (const [,valor] of texto.matchAll(/(?:src|href)=["']([^"']+)["']/g)) referenciar(valor,nome);
  }
  if (/\.css$/.test(nome)) for (const [,valor] of texto.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) referenciar(valor,nome);
  if (/\.js$/.test(nome)) {
    for (const [,valor] of texto.matchAll(/(?:importScripts|(?:chrome\.)?runtime\.getURL)\(["']([^"']+)["']/g)) { if (!/[${}]/.test(valor)) referenciar('/'+valor,nome); }
  }
}
function referenciar(valor, origem) {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(valor)) return;
  const limpo=valor.split(/[?#]/)[0];if(!limpo)return;
  adicionar(limpo.startsWith('/')?limpo.slice(1):path.posix.join(path.posix.dirname(origem),limpo));
}
adicionar('manifest.json');
adicionar(manifest.background.service_worker);
adicionar(manifest.action.default_popup);
adicionar(manifest.options_ui.page);
adicionar('funpass_result.html');adicionar('dashboard/dashboard.html');adicionar('icons/logo-icd-recibo.png');
for (const valor of Object.values(manifest.icons)) adicionar(valor);
for (const bloco of manifest.content_scripts) for (const nome of [...bloco.js||[],...bloco.css||[]]) adicionar(nome);
for (const bloco of manifest.web_accessible_resources) for (const nome of bloco.resources) adicionar(nome);
adicionar('privacy.html',fs.readFileSync(path.join(root,'docs/PRIVACIDADE.html')));
const tabela=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=buffer=>{let c=0xffffffff;for(const b of buffer)c=tabela[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const locais=[],central=[];let offset=0;
for(const [nome,conteudo] of [...arquivos].sort(([a],[b])=>a.localeCompare(b))) {
 const nomeBytes=Buffer.from(nome);const comprimido=zlib.deflateRawSync(conteudo,{level:9});const crc=crc32(conteudo);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt16LE(0x21,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(comprimido.length,18);local.writeUInt32LE(conteudo.length,22);local.writeUInt16LE(nomeBytes.length,26);
 locais.push(local,nomeBytes,comprimido);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(0x21,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(comprimido.length,20);c.writeUInt32LE(conteudo.length,24);c.writeUInt16LE(nomeBytes.length,28);c.writeUInt32LE(offset,42);central.push(c,nomeBytes);offset+=local.length+nomeBytes.length+comprimido.length;
}
const centralBuffer=Buffer.concat(central);const fim=Buffer.alloc(22);fim.writeUInt32LE(0x06054b50,0);fim.writeUInt16LE(arquivos.size,8);fim.writeUInt16LE(arquivos.size,10);fim.writeUInt32LE(centralBuffer.length,12);fim.writeUInt32LE(offset,16);
const zip=Buffer.concat([...locais,centralBuffer,fim]);const pasta=path.join(root,'dist');fs.mkdirSync(pasta,{recursive:true});const saida=path.join(pasta,`ICD-Hub-${manifest.version}.zip`);fs.writeFileSync(saida,zip);fs.writeFileSync(saida+'.sha256',crypto.createHash('sha256').update(zip).digest('hex')+'  '+path.basename(saida)+'\n');console.log(JSON.stringify({arquivo:saida,arquivos:arquivos.size,bytes:zip.length}));
