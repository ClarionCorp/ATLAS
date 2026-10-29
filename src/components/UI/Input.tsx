'use client';

import React, { forwardRef, useId, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { WarningIcon, EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { cn } from '../../core/styles/theme';

const errorAnim: Variants = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

const baseInputStyles = cn(
  'w-full bg-zinc-800 text-zinc-100 placeholder:text-zinc-500',
  'border border-zinc-700 rounded-md',
  'transition-[border-color,box-shadow] duration-200',
  'outline-none caret-zinc-200',
  'hover:border-zinc-700',
  'focus:border-zinc-400 focus:ring-3 focus:ring-zinc-400/20',
  'disabled:opacity-40 disabled:cursor-not-allowed'
);

// Labels
interface LabelProps {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}

function Label({ htmlFor, children, required, className }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-sm font-medium text-zinc-300 mb-1.5', className)}>
      {children}
      {required && <span className="text-zinc-200/70 ml-0.5" aria-hidden>*</span>}
    </label>
  );
}

// Hint / Errors
function HintText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-zinc-500">{children}</p>;
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      variants={errorAnim}
      initial="initial"
      animate="animate"
      exit="exit"
      className="mt-1.5 text-xs text-red-500 flex items-center gap-1"
    >
      <WarningIcon size={12} weight="fill" className="shrink-0" />
      {children}
    </motion.p>
  );
}


// Textbox Component
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required, prefix, suffix, type = 'text', className, inputClassName, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const isPassword = type === 'password';
    const [show, setShow] = useState(false);
    const inputType = isPassword ? (show ? 'text' : 'password') : type;
    const hasError = !!error;

    return (
      <div className={cn('flex flex-col', className)}>
        {label && <Label htmlFor={id} required={required}>{label}</Label>}

        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 flex items-center text-zinc-500 pointer-events-none">
              {prefix}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            type={inputType}
            required={required}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
            className={cn(
              baseInputStyles,
              'h-9 px-3 text-sm',
              prefix && 'pl-9',
              (suffix || isPassword) && 'pr-9',
              hasError && 'border-red-500! focus:ring-red-500/20!',
              inputClassName
            )}
            {...props}
          />

          {isPassword ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShow(s => !s)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors duration-150 cursor-pointer"
            >
              {show ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
            </button>
          ) : suffix ? (
            <span className="absolute right-3 flex items-center text-zinc-500 pointer-events-none">
              {suffix}
            </span>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {hasError ? (
            <ErrorText key="error">{error}</ErrorText>
          ) : hint ? (
            <HintText key="hint">{hint}</HintText>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  showCount?: boolean;
  className?: string;
  textareaClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, required, showCount, maxLength, className, textareaClassName, id: idProp, value, onChange, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const hasError = !!error;
    const charCount = typeof value === 'string' ? value.length : 0;

    return (
      <div className={cn('flex flex-col', className)}>
        {label && (
          <div className="flex items-center justify-between mb-1.5">
            <Label htmlFor={id} required={required} className="mb-0">{label}</Label>
            {showCount && maxLength && (
              <span className={cn(
                'text-xs tabular-nums transition-colors duration-150',
                charCount >= maxLength ? 'text-red-500' : charCount >= maxLength * 0.85 ? 'text-amber-400' : 'text-zinc-500'
              )}>
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={id}
          required={required}
          maxLength={maxLength}
          value={value}
          onChange={onChange}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(
            baseInputStyles,
            'px-3 py-2.5 text-sm resize-none min-h-20',
            hasError && 'border-red-500! focus:ring-red-500/20!',
            textareaClassName
          )}
          {...props}
        />

        <AnimatePresence mode="wait">
          {hasError ? (
            <ErrorText key="error">{error}</ErrorText>
          ) : hint ? (
            <HintText key="hint">{hint}</HintText>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';