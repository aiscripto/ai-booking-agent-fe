import React from 'react';
import { useVocabulary } from '../services/vocabulary';
import { can, getSessionUser } from '../services/session';
import { LayoutDashboard, Calendar, PhoneCall, LogOut, CalendarCheck, BarChart3, Stethoscope, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  onLogout,
}) => {
  const { tenantName, error: businessError } = useVocabulary();
  const user = getSessionUser();

  const menuItems = [
    { id: 'dashboard', name: 'Overview', icon: LayoutDashboard },
    { id: 'calendar', name: 'Calendar View', icon: Calendar },
    { id: 'doctor-schedules', name: 'Provider Schedules', icon: Stethoscope },
    { id: 'logs', name: 'Call Transcripts', icon: PhoneCall },
    { id: 'book-online', name: 'New Booking', icon: CalendarCheck },
    { id: 'analytics', name: 'Analytics', icon: BarChart3 },
    // Setup is shown only to roles that may use at least one of its screens.
    ...(can('settings.business') || can('organization.manage') || can('users.manage')
      ? [{ id: 'setup', name: 'Setup', icon: Settings }]
      : []),
  ];




  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between">
        <div>
          {/* Logo Brand */}
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="bg-sky-500/10 p-2 rounded-lg text-sky-400">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none tracking-wide bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">
                VoiceAgent
              </h1>
              <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                SaaS Booking
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500/20 to-cyan-500/10 text-sky-400 border-l-2 border-sky-400'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Tenant context & Logout */}
        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className="px-4 py-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Business</p>
            <p className="text-sm font-medium text-slate-200 truncate mt-1">
              {tenantName ?? (businessError ? 'Could not load' : 'Loading…')}
            </p>
            {user && (
              <p className="text-xs text-slate-500 truncate mt-1" title={user.email}>
                {user.name || user.email} · {user.roleName.toLowerCase()}
              </p>
            )}
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main View Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8">
          <h2 className="text-xl font-bold tracking-wide">
            {menuItems.find((item) => item.id === activeTab)?.name || 'Dashboard'}
          </h2>
          {/* No "agent active" light: the app has no real way to know that, so it shows nothing. */}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-950/50">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
