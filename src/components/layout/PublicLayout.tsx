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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4 pt-8">
        <div className={cn("w-full max-w-lg", contentClassName)}>
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-muted-foreground">
        <p>Bóris © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
