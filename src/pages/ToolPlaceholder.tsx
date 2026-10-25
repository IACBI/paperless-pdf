import { Link, useParams } from 'react-router';
import { getTool } from '../tools/registry';
import ToolIcon from '../components/ToolIcon';

/**
 * Temporary page for tools that aren't built yet. Each milestone replaces
 * the relevant route with a real implementation.
 */
export default function ToolPlaceholder() {
  const { tool: path } = useParams();
  const tool = path ? getTool(path) : undefined;

  if (!tool) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-slate-600">That tool doesn’t exist (yet).</p>
        <Link to="/" className="mt-4 inline-block font-medium text-brand-700 hover:underline">
          ← Back to all tools
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <ToolIcon path={tool.iconPath} className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{tool.title}</h1>
      <p className="mt-2 text-slate-600">{tool.blurb}</p>
      <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        This tool is under construction and will land in an upcoming milestone.
      </p>
      <Link to="/" className="mt-6 inline-block font-medium text-brand-700 hover:underline">
        ← Back to all tools
      </Link>
    </div>
  );
}
