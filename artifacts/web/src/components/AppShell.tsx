import { Activity, CalendarDays, ChartNoAxesCombined, CirclePlus, FileClock, LayoutDashboard, Settings2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";
import { useTrades } from "../context/TradesContext";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/trades", label: "매매 기록", icon: FileClock },
  { href: "/record", label: "기록하기", icon: CirclePlus },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/settings", label: "설정", icon: Settings2 },
];

function Brand() {
  return <div className="brand">
    <div className="brand-mark"><ChartNoAxesCombined size={18} strokeWidth={2.5} /></div>
    <div><div className="brand-title">매매의 기록</div><div className="brand-caption">PERSONAL JOURNAL</div></div>
  </div>;
}

export function AppShell({ children, current }: { children: ReactNode; current: string }) {
  const { syncStatus, syncCode } = useTrades();
  const [location] = useLocation();
  const title = navItems.find((item) => item.href === current)?.label ?? "매매 기록";
  const nav = (mobile = false) => navItems.map(({ href, label, icon: Icon }) => {
    const active = current === href || (href === "/trades" && location.startsWith("/trade/"));
    return <Link key={href} href={href} className={`${mobile ? "" : "nav-link"} ${active ? "active" : ""}`} data-testid={`link-nav-${href.replace("/", "") || "dashboard"}`}>
      <Icon size={mobile ? 18 : 17} /><span>{label}</span>
    </Link>;
  });
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <div className="nav-label">MY JOURNAL</div>
      <nav className="nav-list" aria-label="주요 메뉴">{nav()}</nav>
      <div className="side-bottom">
        <div className="side-note"><strong>오늘도 차분하게</strong>기록은 다음 결정을 더 나은 쪽으로 이끕니다.</div>
      </div>
    </aside>
    <div className="main-area">
      <header className="mobile-header"><Brand /><span className="sync-pill"><i className={`sync-dot ${syncStatus === "ok" ? "ok" : ""}`} />{syncCode ? "동기화 중" : "기기 저장"}</span></header>
      <header className="topbar">
        <div className="crumb">나의 투자 일지 <span style={{ color: "#555b68", margin: "0 8px" }}>/</span> {title}</div>
        <div className="top-actions"><span className="sync-pill"><i className={`sync-dot ${syncStatus === "ok" ? "ok" : ""}`} />{syncCode ? (syncStatus === "error" ? "동기화 확인 필요" : "클라우드 동기화") : "이 기기에 저장 중"}</span><span className="top-date">{new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date())}</span></div>
      </header>
      <main>{children}</main>
    </div>
    <nav className="mobile-bottom-nav" aria-label="모바일 메뉴">{nav(true)}</nav>
  </div>;
}

export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{action}</div>;
}

export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-mark"><Activity size={20} /></div><h3>{title}</h3><p>{copy}</p>{action}</div>;
}

export function Modal({ title, children, onClose, actions }: { title: string; children: ReactNode; onClose: () => void; actions: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">{title}</h2>{children}<div className="modal-actions">{actions}</div>
    </section>
  </div>;
}