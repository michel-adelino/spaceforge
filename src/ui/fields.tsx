import { ReactNode, useEffect, useRef, useState } from 'react';
import { MATERIALS } from '../domain/materials';
import { Icon, IconName } from './Icon';

export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: string; icon?: IconName }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.value}
          className={`seg__btn${o.value === props.value ? ' is-on' : ''}`}
          aria-pressed={o.value === props.value}
          onClick={() => props.onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={15} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="toggle">
      <span>
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </span>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

export function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const [text, setText] = useState(fmt(props.value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(props.value));
  }, [props.value]);
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={props.step ?? 0.05}
        min={props.min}
        max={props.max}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(fmt(props.value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n))
            props.onChange(Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, n)));
        }}
      />
      {props.unit && <em>{props.unit}</em>}
    </label>
  );
}

export function MaterialPicker(props: { ids: string[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Material">
      {props.ids.map((id) => {
        const m = MATERIALS[id];
        return (
          <button
            key={id}
            role="radio"
            aria-checked={id === props.value}
            aria-label={m.name}
            title={m.name}
            className={`swatch${id === props.value ? ' is-on' : ''}${m.texture ? ' is-textured' : ''}`}
            style={{ background: m.color }}
            onClick={() => props.onPick(id)}
          />
        );
      })}
    </div>
  );
}

export function Section(props: { title: string; children: ReactNode; open?: boolean; aside?: ReactNode }) {
  return (
    <details className="section" open={props.open ?? true}>
      <summary>
        <span>{props.title}</span>
        {props.aside}
      </summary>
      <div className="section__body">{props.children}</div>
    </details>
  );
}
