import { type ClassValue, clsx } from "clsx";
import type React from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 border-transparent",
    secondary: "bg-white text-slate-900 border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border-transparent",
  };
  const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={id} className="text-xs font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        className={cn(
          "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={id} className="text-xs font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <textarea
        id={id}
        className={cn(
          "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
}

export function Select({ label, options, className, id, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={id} className="text-xs font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <select
        id={id}
        className={cn(
          "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none",
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        {...props}
      />
      {label ? <span className="text-slate-700">{label}</span> : null}
    </label>
  );
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger";
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  const styles: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-slate-100 text-slate-800",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-slate-200 bg-white p-5 shadow-xs", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Dialog({ open, title, onClose, children }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Table({
  className,
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export interface NavItem {
  label: string;
  to: string;
}

export interface AppShellProps {
  title: string;
  navItems: NavItem[];
  currentPath?: string;
  onNavigate?: (to: string) => void;
  userEmail?: string | null;
  onSignOut?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  title,
  navItems,
  currentPath,
  onNavigate,
  userEmail,
  onSignOut,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <span className="text-lg font-bold tracking-tight text-slate-900">{title}</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active = currentPath === item.to;
            return (
              <a
                key={item.to}
                href={item.to}
                onClick={(e) => {
                  if (onNavigate) {
                    e.preventDefault();
                    onNavigate(item.to);
                  }
                }}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        {userEmail ? (
          <div className="border-t border-slate-200 p-4 text-xs text-slate-600">
            <div className="truncate font-medium text-slate-900">{userEmail}</div>
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="mt-2 text-blue-600 hover:underline cursor-pointer"
              >
                Sign out
              </button>
            ) : null}
          </div>
        ) : null}
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

export interface ToastProps {
  message: string | null;
  variant?: "info" | "success" | "error";
  onDismiss?: () => void;
}

export function Toast({ message, variant = "info", onDismiss }: ToastProps) {
  if (!message) return null;
  const styles: Record<NonNullable<ToastProps["variant"]>, string> = {
    info: "bg-slate-900 text-white",
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
  };
  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg",
        styles[variant],
      )}
    >
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="opacity-80 hover:opacity-100">
          ✕
        </button>
      ) : null}
    </div>
  );
}
