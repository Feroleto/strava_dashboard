import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  showLabel: string;
  hideLabel: string;
}

/** password `<input>` with a show/hide toggle — same visual style used by
 * every password field in the app (login/register/add-password forms) */
export default function PasswordInput({
  showLabel,
  hideLabel,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className="w-full rounded-[11px] border border-border bg-transparent px-3.5 py-[11px] pr-11 text-[14px] text-foreground outline-none placeholder:text-muted-foreground focus:border-acc"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
      >
        {visible ? (
          <EyeOff size={16} strokeWidth={1.8} />
        ) : (
          <Eye size={16} strokeWidth={1.8} />
        )}
      </button>
    </div>
  );
}
