import * as React from "react";

export const Card = ({ className = "", children }: { className?: string; children: React.ReactNode }) => {
  return (
    <div className={`bg-white border rounded-2xl shadow-md ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader = ({ className = "", children }: { className?: string; children: React.ReactNode }) => {
  return <div className={`p-4 border-b flex items-center justify-between ${className}`}>{children}</div>;
};

export const CardTitle = ({ className = "", children }: { className?: string; children: React.ReactNode }) => {
  return <h2 className={`text-lg font-bold ${className}`}>{children}</h2>;
};

export const CardContent = ({ className = "", children }: { className?: string; children: React.ReactNode }) => {
  return <div className={`p-4 ${className}`}>{children}</div>;
};
