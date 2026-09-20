import { useEffect, useRef, useState } from 'react';
import { boundsOf } from '../core/geometry';
import { ThreeView } from '../engine/ThreeView';
import { Canvas2DView } from '../view2d/Canvas2DView';
import { useApp, useModelVersion } from './appState';
import { Icon } from './Icon';
import { SITE } from './siteConfig';
import { Lang, LandingText, TEXT } from './landingText';
import { setLang, useUI } from './store';

const start = () => useUI.setState({ screen: 'editor' });

export function Landing() {
  const lang = useUI((s) => s.lang);
  const t = TEXT[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="landing" lang={lang}>
      <header className="landing__nav">
        <span className="brand brand--static">
          <Icon name="logo" size={22} />
          <span>SpaceForge</span>
        </span>
        <nav>
          <a href="#about">{t.nav.about}</a>
          <a href="#features">{t.nav.features}</a>
          <a href="#architecture">{t.nav.architecture}</a>
          <a href="#stack">{t.nav.stack}</a>
          <LangSwitch lang={lang} />
          <button className="btn btn--tape" onClick={start}>
            {t.nav.open}
          </button>
        </nav>
      </header>

      <section className="sheet hero">
        <div className="hero__copy">
          <h1>{t.hero.title}</h1>
          <p>{t.hero.lead}</p>
          <div className="hero__cta">
            <button className="btn btn--tape btn--lg" onClick={start}>
              {t.hero.start}
            </button>
            <a className="btn btn--ghost btn--lg" href="#architecture">
              {t.hero.how}
            </a>
          </div>
        </div>
        <HeroVisual t={t} />
        <dl className="titleblock">
          {t.hero.facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="band" id="about">
        <div className="band__inner">
          <div className="band__text">
            <h2>{t.about.title}</h2>
            {t.about.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <aside className="tryit">
            <h3>{t.about.tryTitle}</h3>
            <ol>
              {t.about.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="band band--paper" id="features">
        <div className="band__inner band__inner--stack">
          <h2>{t.features.title}</h2>
          <ul className="features">
            {t.features.items.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="band" id="architecture">
        <div className="band__inner">
          <div className="band__text">
            <h2>{t.architecture.title}</h2>
            <p className="band__lead">{t.architecture.lead}</p>
            {t.architecture.items.map((i) => (
              <div className="point" key={i.title}>
                <h3>{i.title}</h3>
                <p>{i.text}</p>
              </div>
            ))}
          </div>
          <Architecture t={t} />
        </div>
      </section>

      <section className="band band--paper" id="stack">
        <div className="band__inner band__inner--stack">
          <h2>{t.stack.title}</h2>
          <div className="stack-wrap">
            <table className="stack">
              <thead>
                <tr>
                  {t.stack.head.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.stack.rows.map(([area, tool, why]) => (
                  <tr key={area}>
                    <th scope="row">{area}</th>
                    <td>{tool}</td>
                    <td>{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="band" id="roadmap">
        <div className="band__inner band__inner--stack">
          <h2>{t.roadmap.title}</h2>
          <p className="band__lead">{t.roadmap.lead}</p>
          <ul className="roadmap">
            {t.roadmap.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <div className="band__cta">
            <button className="btn btn--tape btn--lg" onClick={start}>
              {t.nav.open}
            </button>
            <span>{t.roadmap.cta}</span>
          </div>
        </div>
      </section>

      {(SITE.repoUrl || SITE.author) && (
        <footer className="landing__footer">
          {SITE.repoUrl && (
            <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
              {t.roadmap.source}
            </a>
          )}
          {SITE.author && (
            <span>
              {t.roadmap.author}: {SITE.author}
            </span>
          )}
        </footer>
      )}
    </div>
  );
}

function LangSwitch({ lang }: { lang: Lang }) {
  return (
    <div className="langswitch" role="group" aria-label="Language">
      {(['ru', 'en'] as const).map((l) => (
        <button
          key={l}
          className={l === lang ? 'is-on' : ''}
          aria-pressed={l === lang}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function HeroVisual({ t }: { t: LandingText }) {
  const app = useApp();
  const scene = useRef<HTMLDivElement>(null);
  const plan = useRef<HTMLDivElement>(null);
  const [noGl, setNoGl] = useState(false);
  useModelVersion();

  useEffect(() => {
    let three: ThreeView | undefined;
    if (ThreeView.isSupported()) {
      try {
        three = new ThreeView(scene.current as HTMLDivElement, app.editor, {
          interactive: false,
          autoRotate: true,
        });
        three.setSettings({ daylight: 'day', wallMode: 'auto' });
      } catch {
        setNoGl(true);
      }
    } else setNoGl(true);
    const flat = new Canvas2DView(plan.current as HTMLDivElement, app.editor, { interactive: false });
    return () => {
      three?.dispose();
      flat.dispose();
    };
  }, [app]);

  const b = boundsOf(app.editor.model.walls.flatMap((w) => [w.a, w.b]));
  const width = b ? b.max.x - b.min.x : 0;

  return (
    <figure className="hero__visual">
      <div className="dimline" aria-hidden="true">
        <span />
        <em>{width.toFixed(2)} m</em>
        <span />
      </div>
      <div className="hero__scene" ref={scene}>
        {noGl && <p className="hero__fallback">{t.hero.noGl}</p>}
      </div>
      <div className="hero__plan" ref={plan} aria-hidden="true" />
      <figcaption>{t.hero.caption}</figcaption>
    </figure>
  );
}

function Architecture({ t }: { t: LandingText }) {
  const d = t.diagram;
  return (
    <svg className="arch" viewBox="0 0 760 400" role="img" aria-label={d.label}>
      <defs>
        <marker
          id="ah"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" fill="currentColor" />
        </marker>
      </defs>
      <g className="arch__edges" markerEnd="url(#ah)">
        <line x1="145" y1="72" x2="145" y2="112" />
        <path d="M250 46H290" />
        <path d="M380 72V150" />
        <path d="M615 72V112L615 150" />
        <path d="M145 262V318" />
        <path d="M380 262V318" />
        <path d="M615 262V318" />
      </g>
      <g className="arch__labels">
        <text x="392" y="118">
          {d.commands}
        </text>
        <text x="157" y="296">
          {d.events}
        </text>
        <text x="392" y="296">
          {d.events}
        </text>
        <text x="627" y="296">
          {d.ops}
        </text>
      </g>
      <Box x={40} y={20} w={210} h={52} title={d.ui[0]} sub={d.ui[1]} />
      <Box x={290} y={20} w={180} h={52} title={d.editor[0]} sub={d.editor[1]} />
      <Box x={520} y={20} w={190} h={52} title={d.collab[0]} sub={d.collab[1]} />
      <Box x={40} y={150} w={670} h={112} title={d.model[0]} sub={d.model[1]} strong />
      <Box x={40} y={322} w={210} h={58} title={d.plan[0]} sub={d.plan[1]} />
      <Box x={290} y={322} w={180} h={58} title={d.scene[0]} sub={d.scene[1]} />
      <Box x={520} y={322} w={190} h={58} title={d.data[0]} sub={d.data[1]} />
    </svg>
  );
}

function Box(p: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  strong?: boolean;
}) {
  return (
    <g className={`arch__box${p.strong ? ' arch__box--strong' : ''}`}>
      <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="2" />
      <text x={p.x + 14} y={p.y + (p.strong ? 40 : 24)} className="arch__title">
        {p.title}
      </text>
      <text x={p.x + 14} y={p.y + (p.strong ? 66 : 42)} className="arch__sub">
        {p.sub}
      </text>
    </g>
  );
}
