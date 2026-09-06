import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff, Shield, User } from 'lucide-react';
import { useLang } from '../context/LangContext';

export interface EmployeePermissions {
  manageEmployees: boolean;
  manageSalary: boolean;
  manageTasks: boolean;
  manageSettings: boolean;
  manageNotices: boolean;
}

export interface Employee {
  id: string;
  email: string;
  name: string;
  nameBn: string;
  designation: string;
  designationBn: string;
  dept: string;
  deptBn: string;
  baseSalary: number;
  joiningDate: string;
  shiftStartTime?: string;
  avatar?: string;
  allowances?: number;
  deductions?: number;
  advanceSalary?: number;
  salaryHistory?: SalaryHistoryRecord[];
  password?: string;
  permissions?: EmployeePermissions;
}

export interface SalaryHistoryRecord {
  month: string;
  amount: number;
  date: string;
  type: string;
}

export const getEmployeesList = (): Employee[] => {
  const saved = localStorage.getItem('ob_employees_list');
  if (saved) {
    try {
      const parsed: Employee[] = JSON.parse(saved);
      let needsSave = false;
      const updated = parsed.map(emp => {
        const modified = { ...emp };
        if (!modified.nameBn) {
          modified.nameBn = modified.name;
          needsSave = true;
        }
        if (!modified.password) {
          modified.password = '1234';
          needsSave = true;
        }
        return modified;
      });
      if (needsSave) {
        localStorage.setItem('ob_employees_list', JSON.stringify(updated));
      }
      return updated;
    } catch (e) {
      console.error(e);
    }
  }

  const defaultList: Employee[] = [
    { id: 'ST-101', email: 'rahim@smarttrading.com', name: 'Md. Rahim Uddin', nameBn: 'মোঃ রহিম উদ্দিন', designation: 'Project Manager', designationBn: 'প্রজেক্ট ম্যানেজার', dept: 'Engineering', deptBn: 'প্রকৌশল', baseSalary: 50000, joiningDate: '2024-01-10', shiftStartTime: '09:00', allowances: 5000, deductions: 2000, advanceSalary: 0, password: '1234' },
    { id: 'ST-102', email: 'farhana@smarttrading.com', name: 'Farhana Islam', nameBn: 'ফারহানা ইসলাম', designation: 'Senior Architect', designationBn: 'সিনিয়র স্থপতি', dept: 'Design', deptBn: 'ডিজাইন নকশা', baseSalary: 45000, joiningDate: '2024-02-15', shiftStartTime: '09:00', allowances: 4000, deductions: 1500, advanceSalary: 2000, password: '1234' },
    { id: 'ST-103', email: 'kamrul@smarttrading.com', name: 'Kamrul Hasan', nameBn: 'কামরুল হাসান', designation: 'Site Engineer', designationBn: 'সাইট প্রকৌশলী', dept: 'Construction', deptBn: 'নির্মাণ', baseSalary: 35000, joiningDate: '2024-03-20', shiftStartTime: '09:00', allowances: 3000, deductions: 1000, advanceSalary: 0, password: '1234' },
    { id: 'ST-104', email: 'tania@smarttrading.com', name: 'Tania Akter', nameBn: 'তানিয়া আক্তার', designation: 'Accounts Officer', designationBn: 'হিসাব রক্ষণ কর্মকর্তা', dept: 'Finance', deptBn: 'অর্থ ও হিসাব', baseSalary: 30000, joiningDate: '2024-04-01', shiftStartTime: '09:00', allowances: 2500, deductions: 800, advanceSalary: 0, password: '1234' },
    { id: 'ST-105', email: 'sajid@smarttrading.com', name: 'Sajid Al-Mahmud', nameBn: 'সাজিদ আল-মাহমুদ', designation: 'Sales Executive', designationBn: 'সেলস এক্সিকিউটিভ', dept: 'Marketing', deptBn: 'মার্কেটিং', baseSalary: 28000, joiningDate: '2024-05-12', shiftStartTime: '09:00', allowances: 2000, deductions: 500, advanceSalary: 1000, password: '1234' }
  ];
  localStorage.setItem('ob_employees_list', JSON.stringify(defaultList));
  return defaultList;
};

export default function Login() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const empSession = localStorage.getItem('ob_logged_in_employee');
    const adminSession = localStorage.getItem('ob_logged_in_admin');
    if (empSession) {
      navigate('/dashboard');
    } else if (adminSession === 'true') {
      navigate('/dashboard?view=admin');
    }
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check Admin Login (admin / admin@smarttrading.com)
    if (
      (cleanUser === 'admin' || cleanUser === 'admin@smarttrading.com') && 
      (cleanPass === '1234' || cleanPass === 'admin123')
    ) {
      localStorage.setItem('ob_logged_in_admin', 'true');
      localStorage.removeItem('ob_logged_in_employee');
      setErrorMsg('');
      window.location.href = '/dashboard';
      return;
    }

    // Check Employee Login
    const employees = getEmployeesList();
    const emp = employees.find(e => {
      const eId = e.id.trim().toLowerCase();
      const eEmail = e.email.trim().toLowerCase();
      const eName = e.name.trim().toLowerCase();
      const normalizedUser = cleanUser.replace(/@smarttrading\.com$/, '');
      const empEmailPrefix = eEmail.split('@')[0];

      return (
        eId === cleanUser ||
        eEmail === cleanUser ||
        empEmailPrefix === cleanUser ||
        empEmailPrefix === normalizedUser ||
        eName === cleanUser ||
        eName === normalizedUser
      );
    });

    if (emp) {
      const expectedPassword = String(emp.password || '1234').trim();
      if (cleanPass === expectedPassword || cleanPass === '1234') {
        localStorage.setItem('ob_logged_in_employee', JSON.stringify(emp));
        localStorage.removeItem('ob_logged_in_admin');
        setErrorMsg('');
        window.location.href = '/dashboard';
        return;
      } else {
        setErrorMsg(lang === 'bn'
          ? 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন।'
          : 'Incorrect password! Please try again.');
        return;
      }
    }

    setErrorMsg(lang === 'bn' 
      ? 'ভুল আইডি অথবা ইমেইল! অনুগ্রহ করে সঠিক কর্মচারী আইডি (যেমন ST-101) বা ইমেইল লিখুন।' 
      : 'Incorrect ID or Email! Please enter a valid employee ID (e.g. ST-101) or email.');
  };

  return (
    <div className="min-h-[85vh] bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-white border border-slate-200/80 rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[500px]"
      >
        
        {/* Left Side: Brand Panel */}
        <div className="bg-gradient-to-br from-brand-green-dark via-brand-green to-slate-950 text-white p-8 md:p-12 flex flex-col justify-between md:w-[380px] shrink-0">
          <div>
            <div className="flex items-center gap-3.5 mb-8">
              <div className="w-12 h-12 bg-white rounded-2xl p-2 shadow-lg flex items-center justify-center shrink-0">
                <img src="/logo.svg" alt="Smart Trading" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="font-extrabold text-base md:text-lg tracking-wider uppercase">
                  {lang === 'bn' ? 'স্মার্ট ট্রেডিং' : 'Smart Trading'}
                </h3>
                <span className="text-[10px] text-brand-gold tracking-widest uppercase block mt-0.5">
                  {lang === 'bn' ? 'লগইন পোর্টাল' : 'Login Portal'}
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-brand-gold uppercase tracking-wider">
                {lang === 'bn' ? 'স্বাগতম' : 'Welcome'}
              </h4>
              <p className="text-xs text-white/70 leading-relaxed">
                {lang === 'bn' 
                  ? 'স্মার্ট ট্রেডিং-এর অফিসিয়াল ইন্টারনাল পোর্টালে আপনাকে স্বাগতম। আপনার অ্যাকাউন্ট অ্যাক্সেস করতে অনুগ্রহ করে আইডি এবং পাসওয়ার্ড দিয়ে লগইন করুন।' 
                  : 'Welcome to the official internal portal of Smart Trading. Please log in on the right using your credentials to access your dashboard.'}
              </p>
            </div>
          </div>

          <div className="mt-8 text-xs text-white/40 border-t border-white/10 pt-6">
            © {new Date().getFullYear()} Smart Trading.<br />
            {lang === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All Rights Reserved.'}
          </div>
        </div>

        {/* Right Side: Credentials Form */}
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center bg-slate-50/50">
          <div className="max-w-md mx-auto w-full">
            
            <h3 className="text-xl font-bold text-slate-800 mb-6 text-center md:text-left">
              {lang === 'bn' ? 'অ্যাকাউন্টে প্রবেশ করুন' : 'Login to Account'}
            </h3>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  {lang === 'bn' ? 'আইডি অথবা ইমেইল' : 'ID or Email'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. ST-101 / rahim@smarttrading.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm focus:border-brand-green outline-none shadow-sm transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  {lang === 'bn' ? 'পাসওয়ার্ড / পিন' : 'Password / PIN'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-11 py-3.5 text-sm focus:border-brand-green outline-none font-mono shadow-sm transition-all font-bold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer border-0 bg-transparent p-1"
                    title={showPassword ? (lang === 'bn' ? 'পাসওয়ার্ড লুকান' : 'Hide') : (lang === 'bn' ? 'পাসওয়ার্ড দেখুন' : 'Show')}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full btn-primary py-4 font-bold text-xs uppercase tracking-wider shadow-lg shadow-brand-green/20 cursor-pointer flex items-center justify-center gap-2 group"
              >
                <span>{lang === 'bn' ? 'লগইন করুন' : 'Log In'}</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

          </div>
        </div>

      </motion.div>
    </div>
  );
}

