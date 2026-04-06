import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PublicLayoutProps {
  children: ReactNode;
  progress?: number;
  contentClassName?: string;
}

export function PublicLayout({ children, progress = 0, contentClassName }: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-amber-50/30">
      <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-slate-200/80">
        <motion.div
          className="h-full bg-amber-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      <main className="flex flex-1 items-center justify-center p-4 pt-8">
        <div className={cn("w-full max-w-lg", contentClassName)}>
          {children}
        </div>
      </main>

      <footer className="py-4 text-center text-sm text-muted-foreground">
        <p>Bóris © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
