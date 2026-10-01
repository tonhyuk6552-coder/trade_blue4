import { ArrowLeft, Compass } from "lucide-react";
import { Link } from "wouter";
import { AppShell } from "../components/AppShell";

export default function NotFound() {
  return <AppShell current=""><div className="page-wrap" style={{minHeight:"72vh",display:"grid",placeItems:"center"}}>
    <div style={{textAlign:"center",maxWidth:440}}>
      <div className="empty-mark" style={{width:58,height:58}}><Compass size={24}/></div>
      <div className="eyebrow">404 · NOT IN YOUR JOURNAL</div>
      <h1>이 페이지는 찾을 수 없어요</h1>
      <p className="page-subtitle" style={{margin:"10px 0 20px"}}>주소를 다시 확인하거나, 기록이 있는 곳으로 돌아가보세요.</p>
      <Link href="/" className="button primary" data-testid="link-not-found-home"><ArrowLeft size={14}/>대시보드로 돌아가기</Link>
    </div>
  </div></AppShell>;
}