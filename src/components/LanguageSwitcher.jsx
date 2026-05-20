import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useI18n } from '../lib/i18n';

/**
 * LanguageSwitcher — dropdown to change the active language.
 *
 * Two variants:
 *   'nav'     — compact button for the navbar (flag + code + chevron)
 *   'footer'  — wider dropdown for the footer
 */
export default function LanguageSwitcher({ variant = 'nav', className = '' }) {
  const { lang, setLang, languages } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = languages.find(l => l.code === lang) || languages[0];

  // Close on click outside
  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const selectLang = (code) => {
    setLang(code);
    setOpen(false);
  };

  if (variant === 'footer') {
    return (
      <div ref={ref} className={`relative inline-block ${className}`}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors px-3 py-2 rounded-lg hover:bg-slate-100"
        >
          <Globe className="w-4 h-4" />
          <span>{current.flag} {current.label}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 max-h-72 overflow-y-auto">
            {languages.map(l => (
              <button
                key={l.code}
                onClick={() => selectLang(l.code)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  l.code === lang
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-base">{l.flag}</span>
                <span className="flex-1 text-left">{l.label}</span>
                {l.code === lang && <Check className="w-4 h-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Nav variant (compact)
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer py-1"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="font-medium uppercase text-xs">{current.code}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 max-h-72 overflow-y-auto">
          {languages.map(l => (
            <button
              key={l.code}
              onClick={() => selectLang(l.code)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                l.code === lang
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span className="flex-1 text-left">{l.label}</span>
              {l.code === lang && <Check className="w-4 h-4 text-emerald-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
