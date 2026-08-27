import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Home } from 'lucide-react';

export default function PageNotFound() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pageName = window.location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          {/* 404 Error Code */}
          <div className="space-y-2">
            <h1 className="text-7xl font-oswald font-light text-muted-foreground">404</h1>
            <div className="h-0.5 w-16 bg-border mx-auto"></div>
          </div>

          {/* Main Message */}
          <div className="space-y-3">
            <h2 className="text-2xl font-oswald font-medium text-foreground">
              Seite nicht gefunden
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Die Seite <span className="font-medium text-foreground">„{pageName}"</span> konnte nicht gefunden werden.
            </p>
          </div>

          {/* Admin Note */}
          {user?.role === 'admin' && (
            <div className="mt-8 p-4 bg-secondary rounded-lg border border-border">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                </div>
                <div className="text-left space-y-1">
                  <p className="text-sm font-medium text-foreground">Admin-Hinweis</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Diese Seite wurde möglicherweise noch nicht implementiert.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-6">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary border border-primary rounded-lg hover:bg-primary/90 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <Home className="w-4 h-4 mr-2" />
              Zur Startseite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
