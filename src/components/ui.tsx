import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
};

export function IconButton({ label, active, className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`grid size-8 shrink-0 place-items-center rounded text-ink-2 transition-colors duration-100 hover:bg-hover hover:text-ink active:bg-press disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

const VARIANTS = {
  primary: "bg-accent-fill text-on-accent hover:bg-accent-hover border-transparent",
  secondary: "bg-card text-ink hover:bg-hover border-line border-b-line-strong",
  danger: "bg-[#c42b1c] text-on-accent hover:bg-[#b02618] border-transparent",
  ghost: "text-ink-2 hover:bg-hover hover:text-ink border-transparent",
};

export function Button({ variant = "secondary", className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 min-w-0 items-center justify-center gap-2 rounded border px-3 transition-colors duration-100 active:opacity-85 disabled:opacity-45 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-6">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 truncate text-[13px] font-semibold text-ink-3">{eyebrow}</div>}
        <h1 className="truncate font-display text-[30px] leading-9 font-bold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[15px] leading-5 text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <div className="mb-2 text-ink-3">{icon}</div>
      <div className="font-semibold text-ink">{title}</div>
      <p className="max-w-sm text-ink-2">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-[14px] font-semibold text-ink">{children}</h2>;
}
