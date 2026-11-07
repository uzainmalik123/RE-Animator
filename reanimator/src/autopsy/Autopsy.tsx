import { useRef, useState } from 'react';
import { autopsyMarkdown, headline, type Autopsy as AutopsyData } from '../../shared/autopsy';
import { useDotCanvas } from '../render/useDotCanvas';
import { slabLuminance } from './scene';

const MARK = { '-': '−', '+': '+', ' ': ' ' } as const;
const CLASS = { '-': 'del', '+': 'add', ' ': 'ctx' } as const;

type Copy = 'idle' | 'copied' | 'unavailable';

// R8: the necromancer reads the body. Real text throughout (the cause, the file, the diff); the dot
// slab is costume and only counts the causes really found. Bone and magic only: red is Death's.
export function Autopsy({ repo, autopsy }: { repo: string | null; autopsy: AutopsyData }) {
  const slab = useRef<HTMLCanvasElement>(null);
  const [copy, setCopy] = useState<Copy>('idle');
  const n = autopsy.causes.length;

  useDotCanvas(slab, 'magic', (c, r, t) => slabLuminance(c, r, { tMs: t, causes: n }), [n]);

  const copyReport = () => {
    const write = typeof navigator === 'undefined' ? undefined : navigator.clipboard?.writeText(autopsyMarkdown(repo, autopsy));
    if (!write) return setCopy('unavailable');
    write.then(() => setCopy('copied'), () => setCopy('unavailable'));
  };

  return (
    <section className="autopsy">
      <h2>The autopsy</h2>
      <canvas ref={slab} className="autopsy-slab" role="img" aria-label={`Autopsy slab: ${n === 0 ? 'no cause found' : `${n} cause${n === 1 ? '' : 's'} found`}`} />
      <p className="cod">{headline(autopsy)}</p>
      {n === 0 && <p className="dim">The body keeps its secret: no known cause was found in what the remedy changed.</p>}
      <div aria-live="off">
        {autopsy.causes.map((c, i) => (
          <article className="cause" key={`${c.file}:${c.title}:${i}`}>
            <h3>{c.title}</h3>
            <p>{c.why}</p>
            <p className="dim">
              <code>{c.file}</code> · {c.seen ? "named in the corpse's real failing output" : "not named in the corpse's failing output"}
            </p>
            {c.lines.length > 0 && (
              <pre className="ruled" tabIndex={0} role="region" aria-label={`Changes to ${c.file}`}>
                <code>
                  {c.lines.map((l, k) => (
                    <span className={`ln ${CLASS[l.op]}`} key={k}>
                      {MARK[l.op]} {l.text}
                      {'\n'}
                    </span>
                  ))}
                </code>
              </pre>
            )}
            {c.truncated && <p className="dim">Evidence truncated.</p>}
          </article>
        ))}
      </div>
      {autopsy.skipped > 0 && <p className="dim">{autopsy.skipped} file{autopsy.skipped === 1 ? '' : 's'} left out of the reading (binary, large, linked or too many).</p>}
      <button type="button" onClick={copyReport}>
        Copy autopsy
      </button>
      {copy === 'copied' && <span role="status"> Copied for your PR description.</span>}
      {copy === 'unavailable' && <span role="status"> Copy is unavailable here.</span>}
    </section>
  );
}
