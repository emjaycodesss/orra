"use client";

import { forwardRef } from "react";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const PushButton = forwardRef<HTMLButtonElement, Props>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <button ref={ref} className={`btn-push ${className}`} {...props}>
        <span className="btn-shadow" />
        <span className="btn-edge" />
        <span className="btn-front">{children}</span>
      </button>
    );
  }
);

PushButton.displayName = "PushButton";
