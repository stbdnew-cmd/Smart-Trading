import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Users as UsersIcon, LogIn, 
  UserCheck, Wallet, Settings, History, ClipboardList, LayoutDashboard, User
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLang } from '../context/LangContext';

export default function MobileBottomNav() {
  const { lang } = useLang();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);

  useEffect(() => {
    const empSession = localStorage.getItem('ob_logged_in_employee');
    const adminSession = localStorage.getItem('ob_logged_in_admin');
    const isEmp = !!empSession;
    const isAdm = !isEmp && adminSession === 'true';
    setIsAdmin(isAdm);
    setIsEmployee(isEmp);
  }, [location.pathname, location.search]);

  const getMobileItems = () => {
    if (isAdmin) {
      return [
        { icon: LayoutDashboard, label: lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard', path: '/dashboard?tab=dashboard' },
        { icon: UserCheck, label: lang === 'bn' ? 'হাজিরা' : 'Attendance', path: '/dashboard?tab=attendance' },
        { icon: UsersIcon, label: lang === 'bn' ? 'কর্মকর্তা' : 'Employees', path: '/dashboard?tab=employees' },
        { icon: Wallet, label: lang === 'bn' ? 'বেতন হিসাব' : 'Salary', path: '/dashboard?tab=salary' },
        { icon: Settings, label: lang === 'bn' ? 'সেটিংস' : 'Settings', path: '/dashboard?tab=settings' },
      ];
    }
    if (isEmployee) {
      return [
        { icon: LayoutDashboard, label: lang === 'bn' ? 'পাঞ্চ' : 'Punch', path: '/dashboard?tab=dashboard' },
        { icon: History, label: lang === 'bn' ? 'হাজিরা লগ' : 'History', path: '/dashboard?tab=history' },
        { icon: Wallet, label: lang === 'bn' ? 'পে-স্লিপ' : 'Payslip', path: '/dashboard?tab=salary' },
        { icon: ClipboardList, label: lang === 'bn' ? 'রিপোর্ট' : 'Reports', path: '/dashboard?tab=report' },
        { icon: User, label: lang === 'bn' ? 'প্রোফাইল' : 'Profile', path: '/dashboard?tab=settings' },
      ];
    }
    return [
      { icon: LayoutDashboard, label: lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard', path: '/dashboard' },
      { icon: LogIn, label: lang === 'bn' ? 'লগইন' : 'Login', path: '/login' },
    ];
  };

  const items = getMobileItems();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-40 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <div className={`grid ${
        items.length === 3 ? 'grid-cols-3' : 
        items.length === 4 ? 'grid-cols-4' : 
        'grid-cols-5'
      }`}>
        {items.map(({ icon: Icon, label, path, isExternal }: any) => {
          const isActive = location.pathname + location.search === path;
          const content = (
            <div className={cn(
              "flex flex-col items-center justify-center gap-1 py-2.5 transition-colors",
              isActive ? "text-brand-green" : "text-slate-400"
            )}>
              <Icon size={20} className={isActive ? "fill-brand-green/10" : ""} />
              <span className="text-[10px] font-semibold">{label}</span>
            </div>
          );

          if (isExternal) {
            return (
              <a key={label} href={path} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            );
          }

          return (
            <Link key={label} to={path}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

