import type { ReactNode } from 'react';
import { getTool } from '../tools/registry';
import ToolIcon from './ToolIcon';

interface ToolShellProps {
  toolId: string;
  children: ReactNode;
}

/** Consistent header (icon + title + blurb) for every tool page. */
export default function ToolShell({ toolId, children }: ToolShellProps) {
  const tool = getTool(toolId);
  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        {tool && (
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ToolIcon path={tool.iconPath} />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{tool?.title ?? toolId}</h1>
          {tool?.blurb && <p className="mt-0.5 text-slate-600">{tool.blurb}</p>}
        </div>
      </header>
      {children}
    </div>
  );
}
