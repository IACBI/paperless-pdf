import { Link } from 'react-router';
import { TOOLS } from '../tools/registry';
import ToolIcon from '../components/ToolIcon';

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Private PDF tools that run entirely in your browser
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-balance text-slate-600">
          Merge, split, compress, convert, rotate, and OCR your PDFs without uploading anything.
          Files are processed on-device with WebAssembly — nothing is ever sent to a server.
        </p>
      </section>

      <section aria-label="Tools" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.id}
            to={`/${tool.path}`}
            className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-brand-100">
                <ToolIcon path={tool.iconPath} />
              </span>
              {tool.status === 'soon' && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  Coming soon
                </span>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">{tool.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{tool.blurb}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
