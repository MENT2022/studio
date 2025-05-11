
'use client'; // Error components must be Client Components

import type { FC } from 'react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const GlobalError: FC<GlobalErrorProps> = ({ error, reset }) => {
  useEffect(() => {
    // Log the error to an error reporting service or console
    console.error("Global Error Boundary Caught:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-destructive">Application Error</CardTitle>
          <CardDescription>
            We're sorry, but something went wrong. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 border rounded-md bg-destructive/10 text-destructive">
            <p className="font-semibold">Error Message:</p>
            <p className="text-sm">{error.message || 'An unexpected error occurred.'}</p>
            {error.digest && (
              <p className="mt-2 text-xs">
                <span className="font-semibold">Digest:</span> {error.digest}
              </p>
            )}
          </div>
          <Button
            onClick={() => reset()}
            className="w-full"
            variant="default"
          >
            Try Again
          </Button>
           <Button
            onClick={() => window.location.assign('/')}
            className="w-full"
            variant="outline"
          >
            Go to Homepage
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default GlobalError;
