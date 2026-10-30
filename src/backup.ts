namespace ICDBackup {
  type Dados = Record<string, unknown>;
  export const grupos = { atalhos:['configMaster','listaPastas'], tarifas:['listaPasseios'], notas:['icd_notas_array'], email:['emailAssunto','emailCorpo'], preferencias:['posicaoBarra','icdFuncionalidades'] } as const;
  type Grupo = keyof typeof grupos;
  declare const chrome: { storage: { local: { get(keys: string[] | null): Promise<Dados>; set(value: Dados): Promise<void> } } };
  const objeto = (v: unknown): v is Dados => Boolean(v && typeof v === 'object' && !Array.isArray(v));
  const texto = (v: unknown): v is string => typeof v === 'string';
  const idSeguro = (v: unknown): boolean => v === undefined || (typeof v === 'number' && Number.isFinite(v)) || (texto(v) && /^[a-zA-Z0-9_.-]+$/.test(v));
  export function selecionar(dados: unknown, escolhidos: string[]): Dados {
    if (!objeto(dados)) throw new Error('O backup deve conter um objeto de configurações.');
    const saida: Dados = {};
    for (const grupo of escolhidos) {
      if (!Object.prototype.hasOwnProperty.call(grupos,grupo)) continue;
      for (const chave of grupos[grupo as Grupo]) {
        if (!Object.prototype.hasOwnProperty.call(dados,chave)) continue;
        const v = dados[chave]; let valido = true;
        if (chave==='configMaster') valido=Array.isArray(v) && v.every(b=>objeto(b)&&idSeguro(b.id)&&texto(b.nome)&&texto(b.texto)&&(!b.pasta||texto(b.pasta))&&(!b.traducoes||(objeto(b.traducoes)&&Object.values(b.traducoes).every(texto))));
        else if(chave==='listaPastas') valido=Array.isArray(v)&&v.every(texto);
        else if(chave==='listaPasseios') {
          valido=Array.isArray(v)&&v.every(p=>{
            if(!objeto(p)||!texto(p.nome)||!Array.isArray(p.ingressos))return false;
            try{ICDCotacao.validarPasseio(p.nome,p.ingressos as ICDCotacao.Ingresso[]);return true;}catch{return false;}
          });
        } else if(chave==='icd_notas_array') valido=Array.isArray(v)&&v.every(n=>objeto(n)&&texto(n.texto)&&n.id!==undefined&&idSeguro(n.id));
        else if(chave==='icdFuncionalidades') valido=objeto(v)&&Object.values(v).every(x=>typeof x==='boolean');
        else if(chave==='posicaoBarra') valido=['topo','direita','esquerda'].includes(String(v));
        else valido=texto(v);
        if(!valido)throw new Error('Formato inválido em '+chave+'. Nenhuma alteração foi aplicada.');
        saida[chave]=v;
      }
    }
    if(!Object.keys(saida).length)throw new Error('O arquivo não contém dados das categorias selecionadas.');
    return saida;
  }
  const chaveItem = (chave:string, valor:unknown):string => {
    if(typeof valor==='string')return ICDCotacao.busca(valor);
    const v=valor as Dados;
    return chave==='configMaster' ? ICDCotacao.busca(String(v.pasta||'Geral')+'|'+v.nome) : chave==='listaPasseios' ? String(v.importacaoChave||ICDCotacao.busca(String(v.nome))) : String(v.texto);
  };
  export function planejar(atual:Dados, entrada:Dados, modo:string):Dados {
    const saida:Dados={};
    for(const [chave,valor] of Object.entries(entrada)) {
      if(modo==='acrescentar'&&Array.isArray(valor)) {
        const itens=Array.isArray(atual[chave])?[...atual[chave] as unknown[]]:[];
        const vistos=new Set(itens.map(i=>chaveItem(chave,i)));
        const ids=new Set(itens.filter(objeto).map(i=>String(i.id)));
        for(const item of valor) {
          const k=chaveItem(chave,item);if(vistos.has(k))continue;
          let novo=item;
          if(objeto(item)&&item.id!==undefined&&ids.has(String(item.id)))novo={...item,id:'importado_'+crypto.randomUUID()};
          itens.push(novo);vistos.add(k);if(objeto(novo))ids.add(String(novo.id));
        }
        saida[chave]=itens;
      } else if(modo==='acrescentar'&&atual[chave]!==undefined) saida[chave]=atual[chave];
      else saida[chave]=valor;
    }
    return saida;
  }
  export function iniciar():void {
    const input=document.getElementById('inputArquivo') as HTMLInputElement|null;if(!input)return;
    const status=document.getElementById('backup-status')!;
    const escolhidos=():string[]=>Array.from(document.querySelectorAll<HTMLInputElement>('[data-backup-grupo]:checked')).map(i=>i.dataset.backupGrupo!);
    let ocupado=false;
    document.getElementById('btnImportar')!.onclick=()=>{if(!ocupado){input.value='';input.click();}};
    document.getElementById('btnExportar')!.onclick=async()=>{
      try{
        const dados=selecionar(await chrome.storage.local.get(null),escolhidos());
        const blob=new Blob([JSON.stringify(dados,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='backup_icdhub_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        status.textContent='Backup exportado somente com as categorias selecionadas.';
      }catch(erro){status.textContent=(erro as Error).message;}
    };
    input.onchange=async()=>{
      const arquivo=input.files?.[0];if(!arquivo||ocupado)return;
      ocupado=true;
      try{
        if(arquivo.size>5*1024*1024)throw new Error('Use um backup de até 5 MB.');
        const entrada=selecionar(JSON.parse(await arquivo.text()),escolhidos());
        const chaves=Object.keys(entrada);const atual=await chrome.storage.local.get(chaves);
        const modo=(document.getElementById('backup-modo') as HTMLSelectElement).value;
        const plano=planejar(atual,entrada,modo);
        const resumo:[string,string][]=chaves.map(k=>[k,Array.isArray(plano[k])?`${Array.isArray(atual[k])?(atual[k] as unknown[]).length:0} → ${(plano[k] as unknown[]).length} itens`:'Configuração selecionada']);
        if(!await ICDOperacao.confirmar({titulo:'Conferir importação do backup',descricao:modo==='acrescentar'?'Acrescenta itens novos. Itens com o mesmo nome/pasta e configurações existentes serão mantidos.':'Substitui somente os dados presentes no arquivo e nas categorias selecionadas. As demais categorias serão preservadas.',campos:resumo,acao:'Aplicar importação'}))return;
        const recente=await chrome.storage.local.get(chaves);
        if(JSON.stringify(recente)!==JSON.stringify(atual))throw new Error('As configurações mudaram durante a revisão. Importe novamente para conferir os dados atuais.');
        await chrome.storage.local.set(plano);
        status.textContent='Importação concluída. Recarregue o painel para editar os cadastros atualizados.';
        (document.getElementById('backup-recarregar') as HTMLButtonElement).hidden=false;
      }catch(erro){status.textContent=(erro as Error).message;}
      finally{ocupado=false;input.value='';}
    };
    document.getElementById('backup-recarregar')!.onclick=()=>location.reload();
  }
  if(typeof document!=='undefined') { if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar(); }
}
