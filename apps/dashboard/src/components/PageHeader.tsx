import { useState } from 'react';
import { Info, X, Lightbulb } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils/cn';
import { useI18n } from '../i18n/I18nContext';
import { pageContent } from '../i18n/pageContent';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  tips?: string[];
  accent?: string;
  actions?: React.ReactNode;
  pageKey?: string;
}

export function PageHeader({ icon: Icon, title, subtitle, description, tips, accent = 'text-accent-primary', actions, pageKey }: PageHeaderProps) {
  const [showInfo, setShowInfo] = useState(true);
  const { t, lang } = useI18n();

  const translated = pageKey ? pageContent[lang][pageKey] : undefined;
  const displayTitle = translated?.title ?? title;
  const displaySubtitle = translated?.subtitle ?? subtitle;
  const displayDescription = translated?.description ?? description;
  const displayTips = translated?.tips ?? tips;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn('w-11 h-11 rounded-card bg-elevated flex items-center justify-center shrink-0', accent)}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-h1 text-text-primary">{displayTitle}</h1>
            <p className="text-small text-text-secondary mt-1">{displaySubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      </div>

      {showInfo && (
        <div className="card p-4 border-l-2 border-l-accent-primary/40 bg-accent-primary/5">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Info className="w-4 h-4 text-accent-primary" />
              <span className="text-sm font-semibold text-text-primary">{t('whatIsThis')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-secondary leading-relaxed">{displayDescription}</p>
              {displayTips && displayTips.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {displayTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Lightbulb className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                      <p className="text-small text-text-secondary">{tip}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="btn-icon !w-7 !h-7 shrink-0 text-text-muted hover:text-text-primary"
              title={t('dismiss')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
