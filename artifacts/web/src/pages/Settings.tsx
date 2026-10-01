import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Cloud, Copy, Download, FileSpreadsheet, FileUp, Plus, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormField } from "../components/ui/form";
import { AppShell, Modal, PageHeading } from "../components/AppShell";
import { useTrades } from "../context/TradesContext";
import { useToast } from "../components/Toast";
import { useHealthCheck } from "@workspace/api-client-react";

type AccountForm = { name:string };
export default function Settings() {
  const { accounts,trades,syncCode,syncStatus,createSync,connectSync,disconnectSync,addAccount,updateAccount,deleteAccount,reorderAccounts,exportBackup,importBackup,importFromExcel,exportExcelTemplate,clearAllData }=useTrades();
  const toast=useToast();
  const {isSuccess:apiOnline,isError:apiOffline,isPending:checking}=useHealthCheck({query:{queryKey:["/api/healthz"],staleTime:30000}});
  const form=useForm<AccountForm>({defaultValues:{name:""}});
  const [editing,setEditing]=useState<Record<string,string>>({});
  const [syncInput,setSyncInput]=useState("");
  const [busy,setBusy]=useState(false);
  const [dialog,setDialog]=useState<string|null>(null);
  const [pendingBackup,setPendingBackup]=useState<File|null>(null);
  const [pendingCode,setPendingCode]=useState("");
  const jsonRef=useRef<HTMLInputElement>(null), excelRef=useRef<HTMLInputElement>(null);
  const {handleSubmit,control,reset}=form;
  const saveAccount=handleSubmit(({name})=>{const clean=name.trim();if(!clean){toast("계좌 이름을 입력해주세요.");return;}addAccount(clean);reset({name:""});toast("계좌를 추가했습니다.");});
  const beginConnect=async()=>{
    const code=syncInput.trim().toUpperCase();
    if(!code){toast("동기화 코드를 입력해주세요.");return;}
    setBusy(true);
    try{const result=await connectSync(code);if(result==="ok"){setDialog(null);setSyncInput("");toast("클라우드 기록과 연결했습니다.");}
      else if(result==="empty_cloud"){setPendingCode(code);setDialog("overwrite");}
      else toast("코드를 확인하거나 잠시 후 다시 시도해주세요.");
    }catch{toast("동기화를 연결하지 못했습니다.");}finally{setBusy(false);}
  };
  const createCloud=async()=>{setBusy(true);try{const code=await createSync();toast(`동기화 코드 ${code}를 만들었습니다.`);}catch(error){toast(error instanceof Error?error.message:"동기화 코드를 만들지 못했습니다.");}finally{setBusy(false);}};
  const acceptOverwrite=async()=>{setBusy(true);try{const result=await connectSync(pendingCode,true);if(result==="ok"){setDialog(null);setSyncInput("");toast("이 기기의 기록을 클라우드에 저장했습니다.");}else toast("클라우드에 연결하지 못했습니다.");}finally{setBusy(false);}};
  const downloadTemplate=async()=>{setBusy(true);try{await exportExcelTemplate();}catch(error){toast(error instanceof Error?error.message:"Excel 양식을 만들지 못했습니다.");}finally{setBusy(false);}};
  const chooseFile=async(kind:"json"|"excel",file?:File)=>{
    if(!file)return;
    if(kind==="json"){
      setPendingBackup(file);
      setDialog("restore");
      if(jsonRef.current)jsonRef.current.value="";
      return;
    }
    setBusy(true);
    try{const result=await importFromExcel(file);toast(`${result.imported}건을 가져왔고 ${result.skipped}건은 건너뛰었습니다.`);}
    catch(error){toast(error instanceof Error?error.message:"파일을 읽지 못했습니다.");}
    finally{setBusy(false);if(excelRef.current)excelRef.current.value="";}
  };
  const confirmBackup=async()=>{
    if(!pendingBackup)return;
    setBusy(true);
    try{
      const count=await importBackup(pendingBackup);
      setDialog(null);
      setPendingBackup(null);
      toast(`${count}개 포지션을 복원했습니다.`);
    }catch(error){toast(error instanceof Error?error.message:"백업 파일을 읽지 못했습니다.");}
    finally{setBusy(false);if(jsonRef.current)jsonRef.current.value="";}
  };
  const copyCode=async()=>{if(!syncCode)return;try{await navigator.clipboard.writeText(syncCode);toast("동기화 코드를 복사했습니다.");}catch{toast(`동기화 코드: ${syncCode}`);}};
  const moveAccount=(index:number,direction:-1|1)=>reorderAccounts(index,index+direction);
  return <AppShell current="/settings"><div className="page-wrap">
    <PageHeading eyebrow="YOUR SPACE" title="설정과 데이터" subtitle="계좌를 정리하고, 기록을 안전하게 보관하세요." />
    <div className="settings-grid">
      <section className="panel settings-card">
        <div className="section-title"><div><h2>계좌 관리</h2><div className="section-caption">{accounts.length}개 계좌 · 순서는 기록 선택 항목에 반영됩니다.</div></div></div>
        <div>{accounts.map((account,index)=><div className="account-row" key={account.id} data-testid={`row-account-${account.id}`}>
          <div style={{display:"grid",gap:2,flex:1,minWidth:0}}>
            <input className="input" aria-label={`${account.name} 이름`} value={editing[account.id]??account.name} onChange={(event)=>setEditing({...editing,[account.id]:event.target.value})} onBlur={()=>{const value=editing[account.id]?.trim();if(value&&value!==account.name)updateAccount(account.id,value);}} onKeyDown={(event)=>{if(event.key==="Enter"){event.currentTarget.blur();}}} data-testid={`input-account-${account.id}`}/>
            <span className="hint">{trades.filter((trade)=>trade.accountId===account.id).length}개 포지션</span>
          </div>
          <button className="icon-button" aria-label={`${account.name} 위로`} disabled={index===0} onClick={()=>moveAccount(index,-1)} data-testid={`button-account-up-${account.id}`}><ArrowUp size={14}/></button>
          <button className="icon-button" aria-label={`${account.name} 아래로`} disabled={index===accounts.length-1} onClick={()=>moveAccount(index,1)} data-testid={`button-account-down-${account.id}`}><ArrowDown size={14}/></button>
          <button className="icon-button danger" aria-label={`${account.name} 삭제`} onClick={()=>setDialog(`account:${account.id}`)} data-testid={`button-account-delete-${account.id}`}><Trash2 size={14}/></button>
        </div>)}</div>
        <div className="rule"/>
        <Form {...form}><form onSubmit={saveAccount} style={{display:"flex",gap:8}}>
          <FormField control={control} name="name" rules={{required:"계좌 이름을 입력해주세요."}} render={({field})=><input className="input" placeholder="새 계좌 이름" aria-label="새 계좌 이름" {...field} data-testid="input-new-account"/>}/>
          <button className="button" type="submit" data-testid="button-add-account"><Plus size={14}/>추가</button>
        </form></Form>
      </section>
      <section className="panel settings-card">
        <div className="section-title"><div><h2>클라우드 동기화</h2><div className="section-caption">여러 기기에서 같은 매매 일지를 이어보세요.</div></div><Cloud size={18} color="#82a8fa"/></div>
        <p className="setting-description">동기화 코드는 비밀번호처럼 안전하게 보관하세요. 연결된 데이터는 계정 없이 코드로만 접근합니다.</p>
        {syncCode ? <><div className="sync-code" data-testid="text-sync-code">{syncCode}</div><button className="button small" style={{marginLeft:8}} onClick={()=>void copyCode()} data-testid="button-copy-sync-code"><Copy size={13}/>코드 복사</button>
          <div className="rule"/>
          <div className="sync-pill" data-testid="status-sync"><i className={`sync-dot ${syncStatus==="ok"?"ok":""}`} />{syncStatus==="ok"?"마지막 동기화가 완료되었습니다.":syncStatus==="syncing"?"동기화 중입니다…":syncStatus==="error"?"연결 상태를 확인해주세요.":"대기 중"}</div>
          <button className="button quiet small" style={{marginTop:14}} onClick={()=>{disconnectSync();toast("이 기기의 클라우드 연결을 해제했습니다.");}} data-testid="button-disconnect-sync">연결 해제</button>
        </> : <div className="setting-actions">
          <button className="button primary" onClick={()=>void createCloud()} disabled={busy} data-testid="button-create-sync">{busy?"연결 중…":"새 동기화 코드 만들기"}</button>
          <button className="button" onClick={()=>setDialog("connect")} data-testid="button-open-connect">기존 코드로 연결</button>
        </div>}
      </section>
      <section className="panel settings-card full">
        <div className="section-title"><div><h2>백업과 가져오기</h2><div className="section-caption">기록의 사본을 만들거나 다른 파일에서 불러옵니다.</div></div></div>
        <p className="setting-description">JSON 백업은 포지션, 거래 기록, 계좌와 전략 태그를 보존합니다. Excel은 지정된 양식을 사용해 매매 내역을 추가할 수 있습니다.</p>
        <div className="setting-actions">
          <button className="button" onClick={exportBackup} data-testid="button-export-json"><Download size={14}/>JSON 백업 저장</button>
          <button className="button" onClick={()=>jsonRef.current?.click()} disabled={busy} data-testid="button-import-json"><FileUp size={14}/>JSON 복원</button>
          <button className="button" onClick={()=>void downloadTemplate()} disabled={busy} data-testid="button-download-excel-template"><FileSpreadsheet size={14}/>Excel 양식 받기</button>
          <button className="button" onClick={()=>excelRef.current?.click()} disabled={busy} data-testid="button-import-excel"><FileSpreadsheet size={14}/>Excel 가져오기</button>
          <input ref={jsonRef} className="file-input" type="file" accept=".json,application/json" onChange={(event)=>void chooseFile("json",event.target.files?.[0])} aria-label="JSON 백업 파일 선택" data-testid="input-import-json-file"/>
          <input ref={excelRef} className="file-input" type="file" accept=".xlsx,.xls" onChange={(event)=>void chooseFile("excel",event.target.files?.[0])} aria-label="Excel 매매 파일 선택" data-testid="input-import-excel-file"/>
        </div>
      </section>
      <section className="panel settings-card">
        <div className="section-title"><div><h2>서비스 상태</h2><div className="section-caption">동기화 서버 응답 여부</div></div>{checking?<RefreshCw size={16} color="#858b99"/>:apiOnline?<Wifi size={17} color="#00d26a"/>:<WifiOff size={17} color="#ff6e65"/>}</div>
        <div className="sync-pill" data-testid="status-service-health"><i className={`sync-dot ${apiOnline?"ok":""}`} />{checking?"서버 확인 중":apiOnline?"서버에 연결할 수 있습니다.":apiOffline?"서버에 연결할 수 없습니다.":"상태 확인 대기 중"}</div>
        <p className="setting-description" style={{marginTop:12,marginBottom:0}}>시세 조회는 종목 상세 화면에서 확인할 수 있습니다. 서버 상태는 매매 기록의 로컬 저장과 별개입니다.</p>
      </section>
      <section className="panel settings-card" style={{borderColor:"#4a2c2c"}}>
        <div className="section-title"><div><h2>모든 기록 지우기</h2><div className="section-caption">되돌릴 수 없는 작업입니다.</div></div><Trash2 size={17} color="#ff7068"/></div>
        <p className="setting-description">저장된 모든 포지션과 계좌를 삭제하고 기본 계좌로 되돌립니다. 실행 전 JSON 백업을 권장합니다.</p>
        <button className="button danger" onClick={()=>setDialog("clear")} data-testid="button-open-clear-data">기록 전체 삭제</button>
      </section>
    </div>
    {dialog==="restore"&&<Modal title="현재 일지를 백업으로 바꿀까요?" onClose={()=>{if(!busy){setDialog(null);setPendingBackup(null);}}} actions={<><button className="button quiet" disabled={busy} onClick={()=>{setDialog(null);setPendingBackup(null);}} data-testid="button-cancel-restore">취소</button><button className="button primary" disabled={busy||!pendingBackup} onClick={()=>void confirmBackup()} data-testid="button-confirm-restore">{busy?"복원 중…":"백업 복원"}</button></>}>
      <p className="modal-copy">{pendingBackup?.name ?? "선택한 파일"}의 내용으로 현재 포지션과 계좌를 모두 교체합니다. 계속하기 전에 JSON 백업을 권장합니다.</p>
      {syncCode&&<p className="modal-copy">클라우드 동기화가 연결되어 있어 복원한 기록이 다른 연결 기기에도 반영됩니다.</p>}
    </Modal>}
    {dialog==="connect"&&<Modal title="동기화 코드로 연결" onClose={()=>setDialog(null)} actions={<><button className="button quiet" onClick={()=>setDialog(null)} data-testid="button-cancel-connect">취소</button><button className="button primary" disabled={busy} onClick={()=>void beginConnect()} data-testid="button-confirm-connect">{busy?"확인 중…":"연결하기"}</button></>}>
      <p className="modal-copy">다른 기기에서 만든 코드를 입력하면 클라우드 기록을 불러옵니다.</p><input className="input" value={syncInput} onChange={(event)=>setSyncInput(event.target.value.toUpperCase())} placeholder="예: AB12CD" aria-label="동기화 코드" data-testid="input-sync-code"/>
    </Modal>}
    {dialog==="overwrite"&&<Modal title="클라우드가 비어 있습니다" onClose={()=>setDialog(null)} actions={<><button className="button quiet" onClick={()=>setDialog(null)} data-testid="button-cancel-overwrite">취소</button><button className="button primary" disabled={busy} onClick={()=>void acceptOverwrite()} data-testid="button-confirm-overwrite">이 기기 기록 올리기</button></>}>
      <p className="modal-copy">이 코드에는 아직 기록이 없습니다. 이 기기의 {trades.length}개 포지션을 클라우드에 올려 연결할까요?</p>
    </Modal>}
    {dialog==="clear"&&<Modal title="모든 매매 기록을 삭제할까요?" onClose={()=>setDialog(null)} actions={<><button className="button quiet" onClick={()=>setDialog(null)} data-testid="button-cancel-clear">취소</button><button className="button danger" onClick={()=>{clearAllData();setDialog(null);toast("모든 기록을 삭제했습니다.");}} data-testid="button-confirm-clear">영구 삭제</button></>}>
      <p className="modal-copy">포지션 {trades.length}개와 계좌 설정을 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p>
      {syncCode&&<p className="modal-copy">클라우드 동기화가 연결되어 있어 삭제한 내용이 다른 연결 기기에도 반영됩니다.</p>}
    </Modal>}
    {typeof dialog==="string"&&dialog.startsWith("account:")&&<Modal title="계좌를 삭제할까요?" onClose={()=>setDialog(null)} actions={<><button className="button quiet" onClick={()=>setDialog(null)} data-testid="button-cancel-delete-account">취소</button><button className="button danger" onClick={()=>{const id=dialog.slice("account:".length);deleteAccount(id);setDialog(null);toast("계좌를 삭제했습니다.");}} data-testid="button-confirm-delete-account">삭제</button></>}>
      <p className="modal-copy">이 계좌로 기록한 포지션은 남지만 계좌 연결이 해제됩니다.</p>
    </Modal>}
  </div></AppShell>;
}