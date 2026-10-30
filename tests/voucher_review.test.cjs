const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {JSDOM}=require('jsdom');
function ambiente(html=''){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.ingressocomdesconto.com.br/adm/paginas/voucher.asp?id=123'});const w=dom.window;let pendente;let salvos=0;const abas=[];
 w.chrome={storage:{local:{async get(){return {dadosParaEmail:pendente};},async set(v){pendente=v.dadosParaEmail;salvos++;}}}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.open=()=>{const aba={location:{href:''},close(){}};abas.push(aba);return aba;};
 for(const file of ['operacao_review','voucher_review'])vm.runInContext(fs.readFileSync(require.resolve('../scripts/generated/'+file+'.js'),'utf8'),dom.getInternalVMContext());
 return {w,contexto:dom.getInternalVMContext(),api:w.ICDVoucherReview,abas,pendente:()=>pendente,salvos:()=>salvos,setPendente:v=>{pendente=v;}};
}
const pagina='<p>Nome:</p><p>Maria Teste</p><p>E-mail:</p><p>maria@example.test</p><p>Voucher:</p><p>ABC123-1</p><p>Passeio:</p><p>Trem</p><p>Data da visita:</p><p>01/11/2026</p>';
const tick=()=>new Promise(r=>setTimeout(r,0));
test('voucher lê campos inequívocos e deixa resultados ambíguos vazios',()=>{const a=ambiente(pagina);try{const d=a.api.capturar(a.w.document);assert.equal(d.reserva,'ABC123-1');assert.equal(d.data,'2026-11-01');const p=a.w.document.createElement('div');p.innerHTML='<p>Nome:</p><p>Outra pessoa</p>';a.w.document.body.append(p);assert.equal(a.api.capturar(a.w.document).cliente,'');assert.throws(()=>a.api.validar({cliente:'Maria',reserva:'ABC',email:'invalido'}),/e-mail/);}finally{a.w.close();}});
test('voucher cancelado preserva pendência; confirmação salva contexto e abre somente rascunho',async()=>{const a=ambiente(pagina);try{
 a.setPendente({email:'outro@example.test'});a.w.ICDOperacao.confirmar=async()=>false;a.api.abrir();let root=a.w.document.getElementById('icd-voucher-conferencia').shadowRoot;root.querySelector('form').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await tick();assert.equal(a.salvos(),0);assert.equal(a.abas.length,0);
 let revisao;a.w.ICDOperacao.confirmar=async r=>{revisao=r;return true;};root.querySelector('form').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await tick();assert.equal(a.salvos(),1);assert.equal(a.pendente().email,'maria@example.test');assert.equal(a.pendente().contextoVoucher.reserva,'ABC123-1');assert.match(revisao.descricao,/substituir/);assert.match(a.abas[0].location.href,/_action=compose/);
}finally{a.w.close();}});
test('voucher não sobrescreve uma mensagem preparada durante a conferência',async()=>{const a=ambiente(pagina);try{a.w.ICDOperacao.confirmar=async()=>{a.setPendente({email:'nova@example.test'});return true;};a.api.abrir();const root=a.w.document.getElementById('icd-voucher-conferencia').shadowRoot;root.querySelector('form').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await tick();assert.equal(a.salvos(),0);assert.equal(a.pendente().email,'nova@example.test');assert.match(root.getElementById('status').textContent,/Outro atendimento/);}finally{a.w.close();}});
test('checklist informa faltantes e impede continuação mesmo após fechar a revisão',async()=>{const a=ambiente();try{const p=a.w.ICDOperacao.pendencias('Pendências',[['Voucher','ABC'],['E-mail','errado']]);const root=a.w.document.getElementById('icd-operacao-review').shadowRoot;assert.match(root.textContent,/Formato inválido/);root.getElementById('confirmar').click();assert.equal(await p,false);assert.equal(await a.w.ICDOperacao.pendencias('Dados',[['Voucher','ABC'],['E-mail','x@example.test']]),true);}finally{a.w.close();}});

test('botão de voucher acompanha a navegação sem aparecer no formulário de nova reserva',async()=>{
 const a=ambiente(pagina);try{
  vm.runInContext(fs.readFileSync(require.resolve('../scripts/enviar_voucher.js'),'utf8'),a.contexto);
  assert.ok(a.w.document.getElementById('btn-abrir-mail'));
  a.w.history.pushState({},'', '/apps/sales/bookings/new');a.w.document.body.append(a.w.document.createElement('div'));await tick();
  assert.equal(a.w.document.getElementById('btn-abrir-mail'),null);
  a.w.history.pushState({},'', '/apps/sales/bookings/12345678-1234-1234-1234-123456789abc');a.w.document.body.append(a.w.document.createElement('div'));await tick();
  assert.ok(a.w.document.getElementById('btn-abrir-mail'));
  assert.equal(a.abas.length,0);
 }finally{a.w.close();}
});
