import { Route, Switch } from "wouter";
import { ToastProvider } from "./components/Toast";
import Calendar from "./pages/Calendar";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Record from "./pages/Record";
import Settings from "./pages/Settings";
import TradeDetail from "./pages/TradeDetail";
import Trades from "./pages/Trades";

function App() {
  return <ToastProvider>
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/trades" component={Trades} />
      <Route path="/record" component={Record} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/settings" component={Settings} />
      <Route path="/trade/:id" component={TradeDetail} />
      <Route component={NotFound} />
    </Switch>
  </ToastProvider>;
}

export default App;